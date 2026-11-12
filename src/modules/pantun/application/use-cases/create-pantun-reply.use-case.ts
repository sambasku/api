import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import type { ReplyPushCooldownGate } from '@/modules/notification/application/use-cases/discussion-reply-push-cooldown-gate';
import type { NotifyUserUseCase } from '@/modules/device/application/use-cases/notify-user.use-case';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import { resolveDiscussionNotifyRecipients } from '@/modules/comment/application/utils/resolve-discussion-notify-recipients';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import type { RecordAbuseSignalUseCase } from '@/shared/moderation/record-abuse-signal.use-case';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import { ConflictError, NotFoundError, ValidationError } from '@/shared/errors/app-error';
import { type RhymeScheme } from '../../application/utils/rhyme-check';
import {
  prepareOptionalPantunLines,
  preparePantunLines,
} from '../../application/utils/prepare-pantun-lines';
import type { Pantun, PantunAudio, PantunReply } from '../../domain/entities/pantun.entity';
import type { PantunRepository } from '../../domain/repositories/pantun.repository';

export interface CreatePantunReplyCommand {
  parentId: string;
  userId: string;
  /** Wajib 4 baris bila tanpa audio; boleh kosong bila ada audio (voice-only). */
  lines?: string[] | null;
  /** Opsional: kosong = server deteksi sendiri (ABAB lalu AAAA). */
  rhymeScheme?: RhymeScheme | null;
  categoryId?: string | null;
  language?: string | null;
  requestId?: string | null;
  /** Bacaan suara opsional (dari use case audio). */
  audio?: PantunAudio | null;
  id?: string;
}

/**
 * Balas pantun pembuka (post-moderation). parent_id wajib menunjuk
 * pantun published; balasan ke balasan tidak didukung (1 level).
 */
export class CreatePantunReplyUseCase {
  constructor(
    private readonly repo: PantunRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklistRepo: CommentBlocklistRepository,
    private readonly abuse?: RecordAbuseSignalUseCase,
    private readonly activityEvents?: {
      safe: (cmd: {
        kind: 'pantun_reply_created';
        actorId: string;
        targetId: string;
        dedupeKey: string;
      }) => Promise<void>;
    },
    private readonly userRepo?: UserRepository,
    private readonly inbox?: RecordInboxNotificationUseCase,
    private readonly notifyUser?: NotifyUserUseCase,
    private readonly pushCooldown?: ReplyPushCooldownGate,
  ) {}

  async execute(cmd: CreatePantunReplyCommand): Promise<PantunReply> {
    await assertCanContribute(cmd.userId);

    const hasAudio = Boolean(cmd.audio);
    let cleaned: string[];
    let scheme: RhymeScheme;
    let voiceOnly = false;
    if (hasAudio) {
      const prepared = await prepareOptionalPantunLines({
        lines: cmd.lines,
        rhymeScheme: cmd.rhymeScheme,
        userId: cmd.userId,
        entityType: 'pantun_reply',
        requestId: cmd.requestId,
        blocklistRepo: this.blocklistRepo,
        abuse: this.abuse,
      });
      cleaned = prepared.cleaned;
      scheme = prepared.scheme;
      voiceOnly = prepared.voiceOnly;
    } else {
      if (!cmd.lines || cmd.lines.length === 0) {
        throw new ValidationError([
          { field: 'lines', message: 'Pantun harus terdiri dari 4 baris' },
        ]);
      }
      const prepared = await preparePantunLines({
        lines: cmd.lines,
        rhymeScheme: cmd.rhymeScheme,
        userId: cmd.userId,
        entityType: 'pantun_reply',
        requestId: cmd.requestId,
        blocklistRepo: this.blocklistRepo,
        abuse: this.abuse,
      });
      cleaned = prepared.cleaned;
      scheme = prepared.scheme;
    }

    const parent = await this.repo.findById(cmd.parentId);
    if (!parent || parent.status !== 'published') {
      throw new NotFoundError(
        'PANTUN_NOT_FOUND',
        'Pantun yang mau dibalas tidak ditemukan',
      );
    }

    const reply = await this.repo.createReply({
      id: cmd.id,
      parentId: cmd.parentId,
      userId: cmd.userId,
      categoryId: cmd.categoryId ?? null,
      language: cmd.language?.trim() || 'id',
      rhymeScheme: scheme,
      lines: cleaned,
      audio: cmd.audio ?? null,
    });

    await this.auditRepo.record({
      userId: cmd.userId,
      action: 'create',
      entityType: 'pantun_reply',
      entityId: reply.id,
      newData: {
        parent_id: cmd.parentId,
        rhyme_scheme: voiceOnly ? null : reply.rhymeScheme,
        has_audio: hasAudio,
        voice_only: voiceOnly,
      },
      requestId: cmd.requestId ?? null,
    });
    await this.activityEvents?.safe({
      kind: 'pantun_reply_created',
      actorId: cmd.userId,
      targetId: reply.id,
      dedupeKey: `pantun_reply:${reply.id}`,
    });
    await this.notifyThreadParticipants({
      parentId: cmd.parentId,
      ownerUserId: parent.userId,
      actorId: cmd.userId,
      replyLines: cleaned,
      hasAudio,
    });

    return reply;
  }

  private async notifyThreadParticipants(input: {
    parentId: string;
    ownerUserId: string;
    actorId: string;
    replyLines: string[];
    hasAudio: boolean;
  }): Promise<void> {
    if (!this.inbox && !this.notifyUser) return;

    try {
      const priorReplierIds = await this.repo.listDistinctReplierUserIds(
        input.parentId,
      );
      const recipientIds = resolveDiscussionNotifyRecipients({
        actorId: input.actorId,
        ownerUserId: input.ownerUserId,
        priorParticipantIds: priorReplierIds,
      });
      if (recipientIds.length === 0) return;

      let actorName = 'Seseorang';
      if (this.userRepo) {
        const actor = await this.userRepo.findById(input.actorId);
        if (actor) actorName = actor.displayName?.trim() || actor.username;
      }
      const snippet = input.hasAudio
        ? 'mengirim rekaman pantun'
        : truncateSnippet(input.replyLines.join(' / '));
      const body = `${actorName} membalas pantunmu: ${snippet}`;
      const title = 'Balasan pantun baru';

      for (const userId of recipientIds) {
        if (this.inbox) {
          await this.inbox.execute({
            userId,
            type: 'pantun_reply',
            targetKind: 'pantun',
            targetId: input.parentId,
            actorId: input.actorId,
            title,
            body,
            refreshOnConflict: true,
            actionKind: 'pantun',
            actionValue: input.parentId,
          });
        }
        if (!this.notifyUser) continue;
        const maySend =
          !this.pushCooldown || (await this.pushCooldown.maySend(userId));
        if (!maySend) continue;
        await this.notifyUser.execute({
          userId,
          title,
          body,
          actorId: input.actorId,
          data: {
            type: 'pantun_reply',
            target_kind: 'pantun',
            target_id: input.parentId,
            action_kind: 'pantun',
            action_value: input.parentId,
          },
        });
        if (input.actorId !== userId) {
          await this.pushCooldown?.touchAfterSend(userId);
        }
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          level: 'error',
          time: new Date().toISOString(),
          msg: 'pantun reply notify failed',
          parent_id: input.parentId,
          actor_id: input.actorId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}

const SNIPPET_MAX = 80;

function truncateSnippet(text: string): string {
  const flat = text.trim().replace(/\s+/g, ' ');
  return flat.length <= SNIPPET_MAX
    ? flat
    : `${flat.slice(0, SNIPPET_MAX - 1).trimEnd()}...`;
}

export type { Pantun, PantunReply, ConflictError };
