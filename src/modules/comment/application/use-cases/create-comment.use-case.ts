import { ConflictError, NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { WordRepository } from '@/modules/word/domain/repositories/word.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import { applyBlocklistFilter } from '@/modules/comment-blocklist/application/utils/apply-blocklist-filter';
import { extractMentions } from '../utils/extract-mentions';
import { findMentionableUsers } from '@/modules/user/application/utils/find-mentionable-users';
import type { NotifyUserUseCase } from '@/modules/device/application/use-cases/notify-user.use-case';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import type { WordCommentPushCooldownGate } from '@/modules/notification/application/use-cases/word-comment-push-cooldown-gate';
import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import { isHeavyCensor } from '@/shared/moderation/assert-ugc-text-quality';
import { assertUgcTextQualityWithStrike } from '@/shared/moderation/assert-ugc-text-quality-with-strike';
import {
  RecordAbuseSignalUseCase,
  safeRecordAbuseSignal,
} from '@/shared/moderation/record-abuse-signal.use-case';
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
const WORD_COMMENT_MENTION_TITLE = 'Kamu disebut di komentar';

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
    private readonly abuse?: RecordAbuseSignalUseCase,
    private readonly activityEvents?: RecordActivityEventUseCase,
  ) {}

  async execute(cmd: CreateCommentCommand): Promise<Comment> {
    await assertCanContribute(cmd.userId);

    const body = await assertUgcTextQualityWithStrike(cmd.body, {
      userId: cmd.userId,
      abuse: this.abuse,
      entityType: 'comment',
      requestId: cmd.requestId,
      minMeaningfulChars: 1,
    });

    const word = await this.wordRepo.findById(cmd.wordId);
    if (!word) {
      throw new NotFoundError('WORD_NOT_FOUND', 'Kata dengan id tersebut tidak ditemukan');
    }
    if (word.status !== 'published') {
      throw new ConflictError('WORD_NOT_PUBLISHED', 'Komentar hanya bisa ditambahkan pada kata yang tayang');
    }

    const blocked = await this.blocklistRepo.listAllActiveWords();
    const filteredBody = applyBlocklistFilter(body, blocked);
    const wasFiltered = filteredBody !== body;

    const comment = await this.commentRepo.create({
      wordId: cmd.wordId,
      userId: cmd.userId,
      body: filteredBody,
      bodyOriginal: wasFiltered ? body : null,
    });

    // Event feed: komentar langsung published (post-moderation).
    await this.activityEvents?.safe({
      kind: 'comment_created',
      actorId: cmd.userId,
      targetWordId: cmd.wordId,
      targetId: comment.id,
      dedupeKey: `comment:${comment.id}`,
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

    if (wasFiltered && isHeavyCensor(body, filteredBody)) {
      await safeRecordAbuseSignal(this.abuse, {
        userId: cmd.userId,
        signal: 'heavy_censor',
        entityType: 'comment',
        entityId: comment.id,
        requestId: cmd.requestId,
      });
    }

    await this.notifyDiscussionParticipants({
      wordId: cmd.wordId,
      lemma: word.lemma,
      ownerUserId: word.createdBy,
      actorId: cmd.userId,
      commentBody: comment.body,
    });

    await this.notifyMentionedUsers({
      wordId: cmd.wordId,
      lemma: word.lemma,
      actorId: cmd.userId,
      commentBody: comment.body,
    });

    return (await this.commentRepo.findById(comment.id)) ?? comment;
  }

  /**
   * Mention (@username) di komentar kosakata: kirim notifikasi tipe
   * `word_comment_mention` ke tiap user yang disebut. Inbox TIDAK di-refresh
   * on conflict (tiap mention baris sendiri, tidak menimpa notif komentar),
   * push TANPA cooldown mention (keputusan desain: mention = panggilan
   * langsung, harus selalu sampai).
   */
  private async notifyMentionedUsers(input: {
    wordId: string;
    lemma: string;
    actorId: string;
    commentBody: string;
  }): Promise<void> {
    if (!this.inbox && !this.notifyUser) return;
    if (!this.userRepo) return;

    try {
      const usernames = extractMentions(input.commentBody);
      if (usernames.length === 0) return;

      const mentioned = await findMentionableUsers(
        (username) => this.userRepo!.findByUsername(username),
        usernames,
      );
      if (mentioned.length === 0) return;

      let actorName = 'Seseorang';
      const actor = await this.userRepo.findById(input.actorId);
      if (actor) actorName = actor.displayName?.trim() || actor.username;

      const snippet = truncateSnippet(input.commentBody);
      const body = `${actorName} menyebutmu di komentar "${input.lemma}": ${snippet}`;

      for (const user of mentioned) {
        if (user.id === input.actorId) continue; // jangan self-notify

        if (this.inbox) {
          await this.inbox.execute({
            userId: user.id,
            type: 'word_comment_mention',
            targetKind: 'word',
            targetId: input.wordId,
            actorId: input.actorId,
            title: WORD_COMMENT_MENTION_TITLE,
            body,
            refreshOnConflict: false,
            actionKind: 'word',
            actionValue: input.wordId,
          });
        }
        if (this.notifyUser) {
          // Push mention tanpa cooldown: mention = sinyal kuat.
          await this.notifyUser.execute({
            userId: user.id,
            title: WORD_COMMENT_MENTION_TITLE,
            body,
            actorId: input.actorId,
            data: {
              type: 'word_comment_mention',
              target_kind: 'word',
              target_id: input.wordId,
              action_kind: 'word',
              action_value: input.wordId,
            },
          });
        }
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          level: 'error',
          time: new Date().toISOString(),
          msg: 'comment mention notify failed',
          word_id: input.wordId,
          actor_id: input.actorId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
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
            actionKind: 'word',
            actionValue: input.wordId,
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
                action_kind: 'word',
                action_value: input.wordId,
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
