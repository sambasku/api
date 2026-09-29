import { ConflictError, NotFoundError, ValidationError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { WordRepository } from '@/modules/word/domain/repositories/word.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import { applyBlocklistFilter } from '@/modules/comment-blocklist/application/utils/apply-blocklist-filter';
import type { NotifyUserUseCase } from '@/modules/device/application/use-cases/notify-user.use-case';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import type { WordCommentPushCooldownGate } from '@/modules/notification/application/use-cases/word-comment-push-cooldown-gate';
import type { PronunciationStoragePort } from '@/modules/word/application/ports/pronunciation-storage.port';
import {
  clampDurationMs,
  validateAudioFile,
} from '@/modules/word/application/utils/validate-audio-file';
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
import { buildCommentAudioPath } from '../utils/comment-audio-path';

export interface CreateCommentAudioCommand {
  wordId: string;
  userId: string;
  role: string;
  bytes: Uint8Array;
  mimeType: string | null | undefined;
  filename?: string | null;
  body?: string | null;
  durationMs?: unknown;
  requestId?: string | null;
}

const COMMENT_SNIPPET_MAX = 80;
const WORD_COMMENT_TITLE = 'Komentar baru';
const VOICE_SNIPPET = 'mengirim rekaman suara';

function truncateSnippet(text: string, max = COMMENT_SNIPPET_MAX): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}...`;
}

function wordCommentBody(displayName: string, lemma: string, snippet: string): string {
  return `${displayName} juga berkomentar di "${lemma}": ${snippet}`;
}

/**
 * Komentar suara pada lemma (post-moderation, publish langsung).
 * Caption teks opsional; audio wajib. Voice-only: body string kosong.
 */
export class CreateCommentAudioUseCase {
  constructor(
    private readonly commentRepo: CommentRepository,
    private readonly wordRepo: WordRepository,
    private readonly storage: PronunciationStoragePort,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklistRepo: CommentBlocklistRepository,
    private readonly userRepo?: UserRepository,
    private readonly inbox?: RecordInboxNotificationUseCase,
    private readonly notifyUser?: NotifyUserUseCase,
    private readonly pushCooldown?: WordCommentPushCooldownGate,
    private readonly abuse?: RecordAbuseSignalUseCase,
  ) {}

  async execute(cmd: CreateCommentAudioCommand): Promise<Comment> {
    await assertCanContribute(cmd.userId);

    const rawBody = (cmd.body ?? '').trim();
    if (rawBody.length > 1000) {
      throw new ValidationError([
        { field: 'body', message: 'Komentar maksimal 1000 karakter' },
      ]);
    }

    let caption = '';
    if (rawBody.length > 0) {
      caption = await assertUgcTextQualityWithStrike(rawBody, {
        userId: cmd.userId,
        abuse: this.abuse,
        entityType: 'comment',
        requestId: cmd.requestId,
      });
    }

    const word = await this.wordRepo.findById(cmd.wordId);
    if (!word) {
      throw new NotFoundError('WORD_NOT_FOUND', 'Kata dengan id tersebut tidak ditemukan');
    }
    if (word.status !== 'published') {
      throw new ConflictError(
        'WORD_NOT_PUBLISHED',
        'Komentar hanya bisa ditambahkan pada kata yang tayang',
      );
    }

    const file = validateAudioFile({
      bytes: cmd.bytes,
      mimeType: cmd.mimeType,
      filename: cmd.filename,
    });
    const durationMs = clampDurationMs(cmd.durationMs);

    let filteredBody = '';
    let bodyOriginal: string | null = null;
    if (caption.length > 0) {
      const blocked = await this.blocklistRepo.listAllActiveWords();
      filteredBody = applyBlocklistFilter(caption, blocked);
      bodyOriginal = filteredBody !== caption ? caption : null;
    }

    const path = buildCommentAudioPath({
      wordId: cmd.wordId,
      mimeType: file.mimeType,
    });

    const uploaded = await this.storage.upload({
      path,
      content: file.bytes,
      mimeType: file.mimeType,
    });

    const comment = await this.commentRepo.create({
      wordId: cmd.wordId,
      userId: cmd.userId,
      body: filteredBody,
      bodyOriginal,
      audio: {
        url: uploaded.url,
        mimeType: file.mimeType,
        fileSize: uploaded.size,
        durationMs,
        provider: this.storage.providerName,
        providerFileId: uploaded.path,
        sha: uploaded.sha,
      },
    });

    await this.auditRepo.record({
      userId: cmd.userId,
      action: 'create',
      entityType: 'comment',
      entityId: comment.id,
      newData: {
        word_id: cmd.wordId,
        status: 'published',
        has_audio: true,
        censored: bodyOriginal != null,
      },
      requestId: cmd.requestId ?? null,
    });

    if (bodyOriginal != null && isHeavyCensor(caption, filteredBody)) {
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

      const snippet =
        input.commentBody.trim().length > 0
          ? truncateSnippet(input.commentBody)
          : VOICE_SNIPPET;
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
          msg: 'comment audio notify failed',
          word_id: input.wordId,
          actor_id: input.actorId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}
