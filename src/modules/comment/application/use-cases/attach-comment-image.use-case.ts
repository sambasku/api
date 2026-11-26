import { ConflictError, ForbiddenError, NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { NotifyUserUseCase } from '@/modules/device/application/use-cases/notify-user.use-case';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import {
  COMMENT_MEDIA_GROUP_EVENT_KEY,
  type ExplorationGroupNotifier,
} from '@/modules/wa/application/ports/exploration-group-notifier.port';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import type { Comment } from '../../domain/entities/comment.entity';
import type { CommentRepository } from '../../domain/repositories/comment.repository';

export interface AttachCommentImageCommand {
  commentId: string;
  userId: string;
  url: string;
  providerFileId: string;
  requestId?: string | null;
}

/**
 * Lampirkan foto ke komentar published (opsi B).
 * Auto-tayang (post-moderation); notif ke grup WA untuk pemantauan.
 */
export class AttachCommentImageUseCase {
  constructor(
    private readonly commentRepo: CommentRepository,
    private readonly auditRepo: AuditLogRepository,
    _userRepo?: UserRepository,
    _inbox?: RecordInboxNotificationUseCase,
    _notifyUser?: NotifyUserUseCase,
    private readonly groupNotifier?: ExplorationGroupNotifier,
  ) {}

  async execute(cmd: AttachCommentImageCommand): Promise<Comment> {
    await assertCanContribute(cmd.userId);

    const existing = await this.commentRepo.findById(cmd.commentId);
    if (!existing) {
      throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
    }
    if (existing.userId !== cmd.userId) {
      throw new ForbiddenError('FORBIDDEN', 'Hanya penulis yang boleh menambah foto');
    }
    if (existing.status !== 'published') {
      throw new ConflictError(
        'COMMENT_NOT_PUBLISHED',
        'Foto hanya bisa dilampirkan pada komentar yang tayang',
      );
    }
    if (
      existing.image &&
      (existing.image.status === 'pending_review' || existing.image.status === 'published')
    ) {
      throw new ConflictError(
        'COMMENT_IMAGE_EXISTS',
        'Komentar ini sudah punya foto. Hapus atau tunggu pengecekan dulu.',
      );
    }

    const updated = await this.commentRepo.setPendingImage(cmd.commentId, {
      url: cmd.url,
      provider: 'imagekit',
      providerFileId: cmd.providerFileId,
    });
    if (!updated) {
      throw new ConflictError(
        'COMMENT_IMAGE_EXISTS',
        'Komentar ini sudah punya foto. Hapus atau tunggu pengecekan dulu.',
      );
    }

    await this.auditRepo.record({
      userId: cmd.userId,
      action: 'update',
      entityType: 'comment',
      entityId: updated.id,
      newData: {
        image_status: 'published',
        image_provider: 'imagekit',
      },
      requestId: cmd.requestId ?? null,
    });

    await this.notifyGroup({
      actorId: cmd.userId,
      lemma: updated.wordLemma,
    });

    return updated;
  }

  private async notifyGroup(input: {
    actorId: string;
    lemma: string | null;
  }): Promise<void> {
    if (!this.groupNotifier) return;
    try {
      await this.groupNotifier.notify({
        heading: 'Foto komentar baru tayang.',
        jenis: 'Foto komentar kata',
        name: input.lemma?.trim() || 'sebuah kata',
        userId: input.actorId,
        eventKey: COMMENT_MEDIA_GROUP_EVENT_KEY,
      });
    } catch {
      // Gagal kirim grup tidak membatalkan lampiran foto.
    }
  }
}
