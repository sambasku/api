import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import { applyBlocklistFilter } from '@/modules/comment-blocklist/application/utils/apply-blocklist-filter';
import type { WordRepository } from '@/modules/word/domain/repositories/word.repository';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import { isHeavyCensor } from '@/shared/moderation/assert-ugc-text-quality';
import { assertUgcTextQualityWithStrike } from '@/shared/moderation/assert-ugc-text-quality-with-strike';
import {
  RecordAbuseSignalUseCase,
  safeRecordAbuseSignal,
} from '@/shared/moderation/record-abuse-signal.use-case';
import type { Comment } from '../../domain/entities/comment.entity';
import type { CommentRepository } from '../../domain/repositories/comment.repository';

export interface UpdateCommentCommand {
  commentId: string;
  actorId: string;
  body: string;
  requestId?: string | null;
}

/** Edit komentar lemma (author-only, published). Tanpa activity event / re-notify. */
export class UpdateCommentUseCase {
  constructor(
    private readonly commentRepo: CommentRepository,
    private readonly wordRepo: WordRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklistRepo: CommentBlocklistRepository,
    private readonly abuse?: RecordAbuseSignalUseCase,
  ) {}

  async execute(cmd: UpdateCommentCommand): Promise<Comment> {
    await assertCanContribute(cmd.actorId);

    const comment = await this.commentRepo.findById(cmd.commentId);
    if (!comment) {
      throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
    }

    if (comment.userId !== cmd.actorId) {
      throw new ForbiddenError(
        'FORBIDDEN',
        'Hanya penulis yang dapat mengedit komentar ini.',
      );
    }

    if (comment.status !== 'published') {
      throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
    }

    const word = await this.wordRepo.findById(comment.wordId);
    if (!word) {
      throw new NotFoundError('WORD_NOT_FOUND', 'Kata dengan id tersebut tidak ditemukan');
    }
    if (word.status !== 'published') {
      throw new ConflictError(
        'WORD_NOT_PUBLISHED',
        'Komentar hanya bisa diedit pada kata yang tayang',
      );
    }

    const raw = cmd.body.trim();
    if (raw.length > 1000) {
      throw new ValidationError([
        { field: 'body', message: 'Komentar maksimal 1000 karakter' },
      ]);
    }

    const hasAudio = comment.audio != null;
    if (raw.length < 1 && !hasAudio) {
      throw new BadRequestError(
        'VALIDATION_ERROR',
        'Komentar teks tidak boleh kosong',
        [{ field: 'body', message: 'Isi komentar atau gunakan komentar suara' }],
      );
    }

    let body = '';
    if (raw.length > 0) {
      body = await assertUgcTextQualityWithStrike(raw, {
        userId: cmd.actorId,
        abuse: this.abuse,
        entityType: 'comment',
        requestId: cmd.requestId,
        minMeaningfulChars: 1,
      });
    }

    const blocked = await this.blocklistRepo.listAllActiveWords();
    const filteredBody = applyBlocklistFilter(body, blocked);
    const wasFiltered = filteredBody !== body;
    const bodyOriginal = wasFiltered ? body : null;

    const updated = await this.commentRepo.updateBodyWithRevision({
      commentId: cmd.commentId,
      editorId: cmd.actorId,
      body: filteredBody,
      bodyOriginal,
    });
    if (!updated) {
      throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
    }

    const changed =
      comment.body !== filteredBody ||
      (comment.bodyOriginal ?? null) !== bodyOriginal;
    if (changed) {
      await this.auditRepo.record({
        userId: cmd.actorId,
        action: 'update',
        entityType: 'comment',
        entityId: comment.id,
        oldData: {
          word_id: comment.wordId,
          body: comment.body,
          body_original: comment.bodyOriginal,
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
          entityType: 'comment',
          entityId: comment.id,
          requestId: cmd.requestId,
        });
      }
    }

    return updated;
  }
}
