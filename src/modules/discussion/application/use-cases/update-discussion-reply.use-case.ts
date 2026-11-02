import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import { applyBlocklistFilter } from '@/modules/comment-blocklist/application/utils/apply-blocklist-filter';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import { isHeavyCensor } from '@/shared/moderation/assert-ugc-text-quality';
import { assertUgcTextQualityWithStrike } from '@/shared/moderation/assert-ugc-text-quality-with-strike';
import {
  RecordAbuseSignalUseCase,
  safeRecordAbuseSignal,
} from '@/shared/moderation/record-abuse-signal.use-case';
import type { DiscussionReply } from '../../domain/entities/discussion.entity';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';

export interface UpdateDiscussionReplyCommand {
  replyId: string;
  actorId: string;
  body: string;
  requestId?: string | null;
}

/** Edit balasan diskusi (author-only, published). Tanpa activity event / re-notify. */
export class UpdateDiscussionReplyUseCase {
  constructor(
    private readonly repo: DiscussionRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklistRepo: CommentBlocklistRepository,
    private readonly abuse?: RecordAbuseSignalUseCase,
  ) {}

  async execute(cmd: UpdateDiscussionReplyCommand): Promise<DiscussionReply> {
    await assertCanContribute(cmd.actorId);

    const reply = await this.repo.findReplyById(cmd.replyId);
    if (!reply) {
      throw new NotFoundError(
        'DISCUSSION_REPLY_NOT_FOUND',
        'Balasan tidak ditemukan',
      );
    }

    if (reply.userId !== cmd.actorId) {
      throw new ForbiddenError(
        'FORBIDDEN',
        'Hanya penulis yang dapat mengedit balasan ini.',
      );
    }

    if (reply.status !== 'published') {
      throw new NotFoundError(
        'DISCUSSION_REPLY_NOT_FOUND',
        'Balasan tidak ditemukan',
      );
    }

    const raw = cmd.body.trim();
    if (raw.length > 500) {
      throw new ValidationError([
        { field: 'body', message: 'Balasan maksimal 500 karakter' },
      ]);
    }

    const hasAudio = reply.audio != null;
    if (raw.length < 1 && !hasAudio) {
      throw new BadRequestError(
        'VALIDATION_ERROR',
        'Balasan teks tidak boleh kosong',
        [{ field: 'body', message: 'Isi balasan atau gunakan balasan suara' }],
      );
    }

    let body = '';
    if (raw.length > 0) {
      body = await assertUgcTextQualityWithStrike(raw, {
        userId: cmd.actorId,
        abuse: this.abuse,
        entityType: 'discussion_reply',
        requestId: cmd.requestId,
      });
    }

    const blocked = await this.blocklistRepo.listAllActiveWords();
    const filteredBody = applyBlocklistFilter(body, blocked);
    const wasFiltered = filteredBody !== body;
    const bodyOriginal = wasFiltered ? body : null;

    const updated = await this.repo.updateReplyBodyWithRevision({
      replyId: cmd.replyId,
      editorId: cmd.actorId,
      body: filteredBody,
      bodyOriginal,
    });
    if (!updated) {
      throw new NotFoundError(
        'DISCUSSION_REPLY_NOT_FOUND',
        'Balasan tidak ditemukan',
      );
    }

    const changed =
      reply.body !== filteredBody ||
      (reply.bodyOriginal ?? null) !== bodyOriginal;
    if (changed) {
      await this.auditRepo.record({
        userId: cmd.actorId,
        action: 'update',
        entityType: 'discussion_reply',
        entityId: reply.id,
        oldData: {
          discussion_id: reply.discussionId,
          body: reply.body,
          body_original: reply.bodyOriginal,
        },
        newData: {
          body: filteredBody,
          body_original: bodyOriginal,
          censored: wasFiltered,
        },
        requestId: cmd.requestId ?? null,
      });

      if (wasFiltered && body.length > 0 && isHeavyCensor(body, filteredBody)) {
        await safeRecordAbuseSignal(this.abuse, {
          userId: cmd.actorId,
          signal: 'heavy_censor',
          entityType: 'discussion_reply',
          entityId: reply.id,
          requestId: cmd.requestId,
        });
      }
    }

    return updated;
  }
}
