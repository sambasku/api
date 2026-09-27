import { ConflictError, NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { WordRepository } from '@/modules/word/domain/repositories/word.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import { applyBlocklistFilter } from '@/modules/comment-blocklist/application/utils/apply-blocklist-filter';
import type { NotifyUserUseCase } from '@/modules/device/application/use-cases/notify-user.use-case';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import type { WordCommentPushCooldownGate } from '@/modules/notification/application/use-cases/word-comment-push-cooldown-gate';
import type { Comment } from '../../domain/entities/comment.entity';
import type { CommentRepository } from '../../domain/repositories/comment.repository';
import { resolveDiscussionNotifyRecipients } from '../utils/resolve-discussion-notify-recipients';

export interface CreateCommentCommand {
  wordId: string;
  userId: string;
  role: string;
  requestId?: string | null;
  body: string;
}

const COMMENT_SNIPPET_MAX = 80;
const WORD_COMMENT_TITLE = 'Komentar baru';

function truncateSnippet(text: string, max = COMMENT_SNIPPET_MAX): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}...`;
}

function wordCommentBody(displayName: string, lemma: string, snippet: string): string {
  return `${displayName} juga berkomentar di "${lemma}": ${snippet}`;
}

// Tulis komentar (09-api-comment.md). Post-moderation: langsung published.
// Body difilter lewat blocklist; jika berubah, body_original disimpan.
// Setelah create: notifikasi inbox + push ke peserta diskusi (best-effort).
// Push memakai cooldown Skip per user (default 3 menit); inbox tidak di-throttle.
export class CreateCommentUseCase {
  constructor(
    private readonly commentRepo: CommentRepository,
    private readonly wordRepo: WordRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklistRepo: CommentBlocklistRepository,
    private readonly userRepo?: UserRepository,
    private readonly inbox?: RecordInboxNotificationUseCase,
    private readonly notifyUser?: NotifyUserUseCase,
    private readonly pushCooldown?: WordCommentPushCooldownGate,
  ) {}

  async execute(cmd: CreateCommentCommand): Promise<Comment> {
    const word = await this.wordRepo.findById(cmd.wordId);
    if (!word) {
      throw new NotFoundError('WORD_NOT_FOUND', 'Kata dengan id tersebut tidak ditemukan');
    }
    if (word.status !== 'published') {
      throw new ConflictError('WORD_NOT_PUBLISHED', 'Komentar hanya bisa ditambahkan pada kata yang tayang');
    }

    const blocked = await this.blocklistRepo.listAllActiveWords();
    const filteredBody = applyBlocklistFilter(cmd.body, blocked);
    const wasFiltered = filteredBody !== cmd.body;

    const comment = await this.commentRepo.create({
      wordId: cmd.wordId,
      userId: cmd.userId,
      body: filteredBody,
      bodyOriginal: wasFiltered ? cmd.body : null,
    });

    await this.auditRepo.record({
      userId: cmd.userId,
      action: 'create',
      entityType: 'comment',
      entityId: comment.id,
      newData: {
        word_id: cmd.wordId,
        body: comment.body,
        body_original: comment.bodyOriginal,
        status: 'published',
        censored: wasFiltered,
      },
      requestId: cmd.requestId ?? null,
    });

    await this.notifyDiscussionParticipants({
      wordId: cmd.wordId,
      lemma: word.lemma,
      ownerUserId: word.createdBy,
      actorId: cmd.userId,
      commentBody: comment.body,
    });

    return (await this.commentRepo.findById(comment.id)) ?? comment;
  }

  private async notifyDiscussionParticipants(input: {
    wordId: string;
    lemma: string;
    ownerUserId: string | null;
    actorId: string;
    commentBody: string;
  }): Promise<void> {
    if (!this.inbox && !this.notifyUser) return;

    try {
      const priorCommenterIds = await this.commentRepo.listDistinctCommenterUserIds(input.wordId);
      const recipientIds = resolveDiscussionNotifyRecipients({
        actorId: input.actorId,
        ownerUserId: input.ownerUserId,
        priorParticipantIds: priorCommenterIds,
      });
      if (recipientIds.length === 0) return;

      let displayName = 'Seseorang';
      if (this.userRepo) {
        const actor = await this.userRepo.findById(input.actorId);
        if (actor) {
          displayName = actor.displayName?.trim() || actor.username;
        }
      }

      const snippet = truncateSnippet(input.commentBody);
      const body = wordCommentBody(displayName, input.lemma, snippet);
      const title = WORD_COMMENT_TITLE;

      for (const userId of recipientIds) {
        if (this.inbox) {
          await this.inbox.execute({
            userId,
            type: 'word_comment',
            targetKind: 'word',
            targetId: input.wordId,
            actorId: input.actorId,
            title,
            body,
            refreshOnConflict: true,
          });
        }
        if (this.notifyUser) {
          const maySend =
            !this.pushCooldown || (await this.pushCooldown.maySend(userId));
          if (maySend) {
            await this.notifyUser.execute({
              userId,
              title,
              body,
              actorId: input.actorId,
              data: {
                type: 'word_comment',
                target_kind: 'word',
                target_id: input.wordId,
              },
            });
            // Touch setelah attempt (seperti ReviewPushCooldownGate) agar
            // komentar beruntun tidak spam attempt FCM.
            if (input.actorId !== userId) {
              await this.pushCooldown?.touchAfterSend(userId);
            }
          }
        }
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          level: 'error',
          time: new Date().toISOString(),
          msg: 'comment discussion notify failed',
          word_id: input.wordId,
          actor_id: input.actorId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}
