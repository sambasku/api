import { ConflictError, NotFoundError, ValidationError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import { applyBlocklistFilter } from '@/modules/comment-blocklist/application/utils/apply-blocklist-filter';
import { resolveDiscussionNotifyRecipients } from '@/modules/comment/application/utils/resolve-discussion-notify-recipients';
import type { NotifyUserUseCase } from '@/modules/device/application/use-cases/notify-user.use-case';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import type { DiscussionReplyPushCooldownGate } from '@/modules/notification/application/use-cases/discussion-reply-push-cooldown-gate';
import type { DiscussionReply } from '../../domain/entities/discussion.entity';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';

export interface CreateDiscussionReplyCommand {
  discussionId: string;
  userId: string;
  body: string;
  requestId?: string | null;
}

const SNIPPET_MAX = 80;
const REPLY_TITLE = 'Balasan baru';

function truncateSnippet(text: string, max = SNIPPET_MAX): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}...`;
}

function replyNotifyBody(displayName: string, topicLabel: string, snippet: string): string {
  return `${displayName} juga membalas di "${topicLabel}": ${snippet}`;
}

/**
 * Balasan Ruang Diskusi (post-moderation + blocklist).
 * Setelah create: inbox + push ke pemilik thread + peserta sebelumnya
 * (best-effort). Push memakai cooldown Skip per user (setting yang sama
 * dengan komentar kosakata, channel terpisah).
 */
export class CreateDiscussionReplyUseCase {
  constructor(
    private readonly repo: DiscussionRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklistRepo: CommentBlocklistRepository,
    private readonly userRepo?: UserRepository,
    private readonly inbox?: RecordInboxNotificationUseCase,
    private readonly notifyUser?: NotifyUserUseCase,
    private readonly pushCooldown?: DiscussionReplyPushCooldownGate,
  ) {}

  async execute(cmd: CreateDiscussionReplyCommand): Promise<DiscussionReply> {
    const body = cmd.body.trim();
    if (body.length < 1) {
      throw new ValidationError([{ field: 'body', message: 'Balasan minimal 1 karakter' }]);
    }
    if (body.length > 500) {
      throw new ValidationError([{ field: 'body', message: 'Balasan maksimal 500 karakter' }]);
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

    const blocked = await this.blocklistRepo.listAllActiveWords();
    const filteredBody = applyBlocklistFilter(body, blocked);
    const wasFiltered = filteredBody !== body;

    const reply = await this.repo.createReply({
      discussionId: cmd.discussionId,
      userId: cmd.userId,
      body: filteredBody,
      bodyOriginal: wasFiltered ? body : null,
    });

    await this.auditRepo.record({
      userId: cmd.userId,
      action: 'create',
      entityType: 'discussion_reply',
      entityId: reply.id,
      newData: {
        discussion_id: cmd.discussionId,
        status: 'published',
        censored: wasFiltered,
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
      const snippet = truncateSnippet(input.replyBody);
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
          msg: 'discussion reply notify failed',
          discussion_id: input.discussionId,
          actor_id: input.actorId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}
