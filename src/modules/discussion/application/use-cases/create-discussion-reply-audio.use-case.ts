import { ConflictError, NotFoundError, ValidationError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import { applyBlocklistFilter } from '@/modules/comment-blocklist/application/utils/apply-blocklist-filter';
import { resolveDiscussionNotifyRecipients } from '@/modules/comment/application/utils/resolve-discussion-notify-recipients';
import type { NotifyUserUseCase } from '@/modules/device/application/use-cases/notify-user.use-case';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import type { DiscussionReplyPushCooldownGate } from '@/modules/notification/application/use-cases/discussion-reply-push-cooldown-gate';
import type { PronunciationStoragePort } from '@/modules/word/application/ports/pronunciation-storage.port';
import {
  clampDurationMs,
  validateAudioFile,
} from '@/modules/word/application/utils/validate-audio-file';
import type { DiscussionReply } from '../../domain/entities/discussion.entity';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';
import { buildDiscussionReplyAudioPath } from '../utils/discussion-reply-audio-path';

export interface CreateDiscussionReplyAudioCommand {
  discussionId: string;
  userId: string;
  bytes: Uint8Array;
  mimeType: string | null | undefined;
  filename?: string | null;
  body?: string | null;
  durationMs?: unknown;
  requestId?: string | null;
}

const SNIPPET_MAX = 80;
const REPLY_TITLE = 'Balasan baru';
const VOICE_SNIPPET = 'mengirim rekaman suara';

function truncateSnippet(text: string, max = SNIPPET_MAX): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}...`;
}

function replyNotifyBody(displayName: string, topicLabel: string, snippet: string): string {
  return `${displayName} juga membalas di "${topicLabel}": ${snippet}`;
}

/**
 * Balasan suara Ruang Diskusi (post-moderation, publish langsung).
 * Caption teks opsional; audio wajib.
 */
export class CreateDiscussionReplyAudioUseCase {
  constructor(
    private readonly repo: DiscussionRepository,
    private readonly storage: PronunciationStoragePort,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklistRepo: CommentBlocklistRepository,
    private readonly userRepo?: UserRepository,
    private readonly inbox?: RecordInboxNotificationUseCase,
    private readonly notifyUser?: NotifyUserUseCase,
    private readonly pushCooldown?: DiscussionReplyPushCooldownGate,
  ) {}

  async execute(cmd: CreateDiscussionReplyAudioCommand): Promise<DiscussionReply> {
    const rawBody = (cmd.body ?? '').trim();
    if (rawBody.length > 500) {
      throw new ValidationError([
        { field: 'body', message: 'Balasan maksimal 500 karakter' },
      ]);
    }

    const discussion = await this.repo.findById(cmd.discussionId);
    if (!discussion) {
      throw new NotFoundError('DISCUSSION_NOT_FOUND', 'Diskusi tidak ditemukan');
    }
    if (discussion.status !== 'published') {
      throw new ConflictError(
        'DISCUSSION_NOT_PUBLISHED',
        'Balasan hanya bisa ditambahkan pada diskusi yang sudah tayang',
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
    if (rawBody.length > 0) {
      const blocked = await this.blocklistRepo.listAllActiveWords();
      filteredBody = applyBlocklistFilter(rawBody, blocked);
      bodyOriginal = filteredBody !== rawBody ? rawBody : null;
    }

    const path = buildDiscussionReplyAudioPath({
      discussionId: cmd.discussionId,
      mimeType: file.mimeType,
    });

    const uploaded = await this.storage.upload({
      path,
      content: file.bytes,
      mimeType: file.mimeType,
    });

    const reply = await this.repo.createReply({
      discussionId: cmd.discussionId,
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
      entityType: 'discussion_reply',
      entityId: reply.id,
      newData: {
        discussion_id: cmd.discussionId,
        status: 'published',
        has_audio: true,
        censored: bodyOriginal != null,
      },
      requestId: cmd.requestId ?? null,
    });

    await this.notifyThreadParticipants({
      discussionId: cmd.discussionId,
      topicBody: discussion.body,
      ownerUserId: discussion.userId,
      actorId: cmd.userId,
      replyBody: reply.body,
    });

    return (await this.repo.findReplyById(reply.id)) ?? reply;
  }

  private async notifyThreadParticipants(input: {
    discussionId: string;
    topicBody: string | null;
    ownerUserId: string;
    actorId: string;
    replyBody: string;
  }): Promise<void> {
    if (!this.inbox && !this.notifyUser) return;

    try {
      const priorReplierIds = await this.repo.listDistinctReplierUserIds(input.discussionId);
      const recipientIds = resolveDiscussionNotifyRecipients({
        actorId: input.actorId,
        ownerUserId: input.ownerUserId,
        priorParticipantIds: priorReplierIds,
      });
      if (recipientIds.length === 0) return;

      let displayName = 'Seseorang';
      if (this.userRepo) {
        const actor = await this.userRepo.findById(input.actorId);
        if (actor) {
          displayName = actor.displayName?.trim() || actor.username;
        }
      }

      const topicLabel = truncateSnippet(input.topicBody?.trim() || 'Ruang Diskusi');
      const snippet =
        input.replyBody.trim().length > 0
          ? truncateSnippet(input.replyBody)
          : VOICE_SNIPPET;
      const body = replyNotifyBody(displayName, topicLabel, snippet);
      const title = REPLY_TITLE;

      for (const userId of recipientIds) {
        if (this.inbox) {
          await this.inbox.execute({
            userId,
            type: 'discussion_reply',
            targetKind: 'discussion',
            targetId: input.discussionId,
            actorId: input.actorId,
            title,
            body,
            refreshOnConflict: true,
            actionKind: 'discussion',
            actionValue: input.discussionId,
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
                type: 'discussion_reply',
                target_kind: 'discussion',
                target_id: input.discussionId,
                action_kind: 'discussion',
                action_value: input.discussionId,
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
          msg: 'discussion reply audio notify failed',
          discussion_id: input.discussionId,
          actor_id: input.actorId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}
