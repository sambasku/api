import { ConflictError, NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { ImageStoragePort } from '@/modules/image/application/ports/image-storage.port';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import {
  RecordAbuseSignalUseCase,
  safeRecordAbuseSignal,
} from '@/shared/moderation/record-abuse-signal.use-case';
import type { Comment } from '../../domain/entities/comment.entity';
import type { CommentRepository } from '../../domain/repositories/comment.repository';

export interface RejectCommentImageCommand {
  commentId: string;
  actorId: string;
  /** Jika true, catat strike abuse (konten melanggar). */
  abusive?: boolean;
  requestId?: string | null;
}

/** Tolak foto komentar: hapus staging, teks komentar tetap tayang. */
export class RejectCommentImageUseCase {
  constructor(
    private readonly commentRepo: CommentRepository,
    private readonly imageStorage: ImageStoragePort,
    private readonly auditRepo: AuditLogRepository,
    private readonly inbox?: RecordInboxNotificationUseCase,
    private readonly abuse?: RecordAbuseSignalUseCase,
  ) {}

  async execute(cmd: RejectCommentImageCommand): Promise<Comment> {
    const existing = await this.commentRepo.findById(cmd.commentId);
    if (!existing) {
      throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
    }
    if (
      !existing.image ||
      (existing.image.status !== 'pending_review' && existing.image.status !== 'published')
    ) {
      throw new ConflictError(
        'COMMENT_IMAGE_NOT_MODERATABLE',
        'Foto komentar tidak tersedia untuk diturunkan',
      );
    }

    const wasPending = existing.image.status === 'pending_review';
    const stagingFileId =
      existing.image.provider === 'imagekit' ? existing.image.providerFileId : null;
    const updated = await this.commentRepo.rejectImage(cmd.commentId, cmd.actorId);
    if (!updated) {
      throw new ConflictError(
        'COMMENT_IMAGE_NOT_MODERATABLE',
        'Foto komentar tidak tersedia untuk diturunkan',
      );
    }

    if (stagingFileId) {
      await this.imageStorage.deleteFile(stagingFileId);
    }

    await this.auditRepo.record({
      userId: cmd.actorId,
      action: 'update',
      entityType: 'comment',
      entityId: updated.id,
      oldData: { image_status: existing.image.status },
      newData: { image_status: 'rejected', abusive: cmd.abusive === true },
      requestId: cmd.requestId ?? null,
    });

    if (cmd.abusive) {
      await safeRecordAbuseSignal(this.abuse, {
        userId: existing.userId,
        signal: 'comment_takedown',
        entityType: 'comment',
        entityId: existing.id,
        requestId: cmd.requestId,
      });
    }

    await this.inbox?.execute({
      userId: existing.userId,
      type: 'comment_image_rejected',
      targetKind: 'word',
      targetId: existing.wordId,
      actorId: cmd.actorId,
      title: wasPending ? 'Foto komentar tidak lolos' : 'Foto komentar diturunkan',
      body: wasPending
        ? 'Fotomu di komentar tidak lolos pengecekan. Teks komentar tetap tayang.'
        : 'Fotomu di komentar diturunkan oleh moderator. Teks komentar tetap tayang.',
      actionKind: 'word',
      actionValue: existing.wordId,
    });

    return updated;
  }
}
