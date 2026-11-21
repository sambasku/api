import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import { applyBlocklistFilter } from '@/modules/comment-blocklist/application/utils/apply-blocklist-filter';
import { isHeavyCensor } from '@/shared/moderation/assert-ugc-text-quality';
import { assertUgcTextQualityWithStrike } from '@/shared/moderation/assert-ugc-text-quality-with-strike';
import {
  RecordAbuseSignalUseCase,
  safeRecordAbuseSignal,
} from '@/shared/moderation/record-abuse-signal.use-case';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import type { JinyeComment } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

const MAX_BODY = 500;

export interface UpdateJinyeCommentCommand {
  jinyeId: string;
  commentId: string;
  userId: string;
  body: string;
  requestId?: string | null;
}

/** Edit komen Jinye (author-only, published). Tanpa activity event / re-notify. */
export class UpdateJinyeCommentUseCase {
  constructor(
    private readonly repo: JinyeRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklistRepo: Pick<
      CommentBlocklistRepository,
      'listAllActiveWords'
    >,
    private readonly abuse?: RecordAbuseSignalUseCase,
  ) {}

  async execute(cmd: UpdateJinyeCommentCommand): Promise<JinyeComment> {
    await assertCanContribute(cmd.userId);

    const existing = await this.repo.findCommentById(cmd.commentId);
    if (
      !existing ||
      existing.jinyeId !== cmd.jinyeId ||
      existing.status !== 'published'
    ) {
      throw new NotFoundError(
        'JINYE_COMMENT_NOT_FOUND',
        'Komentar tidak ditemukan',
      );
    }
    if (existing.userId !== cmd.userId) {
      throw new ForbiddenError(
        'FORBIDDEN',
        'Hanya penulis yang boleh mengedit',
      );
    }

    const jinye = await this.repo.findById(cmd.jinyeId);
    if (!jinye || jinye.status !== 'published') {
      throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
    }

    const raw = cmd.body.trim();
    if (raw.length > MAX_BODY) {
      throw new ValidationError([
        { field: 'body', message: `Teks maksimal ${MAX_BODY} karakter` },
      ]);
    }

    const hasImages = existing.images.length > 0;
    if (raw.length < 1 && !hasImages) {
      throw new BadRequestError(
        'VALIDATION_ERROR',
        'Komentar teks tidak boleh kosong',
        [{ field: 'body', message: 'Isi komentar atau lampirkan foto' }],
      );
    }

    let body = '';
    if (raw.length > 0) {
      body = await assertUgcTextQualityWithStrike(raw, {
        userId: cmd.userId,
        abuse: this.abuse,
        entityType: 'jinye_comment',
        requestId: cmd.requestId,
        minMeaningfulChars: 1,
      });
    }

    const blocked = await this.blocklistRepo.listAllActiveWords();
    const filteredBody = applyBlocklistFilter(body, blocked);
    const wasFiltered = filteredBody !== body;
    const bodyOriginal = wasFiltered ? body : null;

    const updated = await this.repo.updateCommentWithRevision({
      commentId: cmd.commentId,
      editorId: cmd.userId,
      body: filteredBody,
      bodyOriginal,
    });
    if (!updated) {
      throw new NotFoundError(
        'JINYE_COMMENT_NOT_FOUND',
        'Komentar tidak ditemukan',
      );
    }

    const bodyChanged = existing.body !== filteredBody;
    const changed =
      bodyChanged || (existing.bodyOriginal ?? null) !== bodyOriginal;
    if (changed) {
      await this.auditRepo.record({
        userId: cmd.userId,
        action: 'update',
        entityType: 'jinye_comment',
        entityId: existing.id,
        oldData: {
          jinye_id: existing.jinyeId,
          body: existing.body,
          body_original: existing.bodyOriginal,
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
          userId: cmd.userId,
          signal: 'heavy_censor',
          entityType: 'jinye_comment',
          entityId: existing.id,
          requestId: cmd.requestId,
        });
      }
    }

    // Span lemma di body lama jadi stale (sama pola edit OP Jinye).
    if (bodyChanged) {
      await this.repo.markCommentLemmaLinksStale(cmd.commentId);
    }

    return updated;
  }
}
