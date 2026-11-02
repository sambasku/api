import { ConflictError, ForbiddenError, NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { NotifyUserUseCase } from '@/modules/device/application/use-cases/notify-user.use-case';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import type { Comment } from '../../domain/entities/comment.entity';
import type { CommentRepository } from '../../domain/repositories/comment.repository';

const COMMENT_IMAGE_MODERATOR_ROLES = ['admin', 'root', 'reviewer', 'editor'] as const;
const PENDING_TITLE = 'Foto komentar menunggu cek';

export interface AttachCommentImageCommand {
  commentId: string;
  userId: string;
  url: string;
  providerFileId: string;
  requestId?: string | null;
}

/**
 * Lampirkan foto staging ke komentar published (opsi B).
 * Teks sudah tayang; foto masuk antrean pending_review.
 */
export class AttachCommentImageUseCase {
  constructor(
    private readonly commentRepo: CommentRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly userRepo?: UserRepository,
    private readonly inbox?: RecordInboxNotificationUseCase,
    private readonly notifyUser?: NotifyUserUseCase,
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
        image_status: 'pending_review',
        image_provider: 'imagekit',
      },
      requestId: cmd.requestId ?? null,
    });

    await this.notifyModerators({
      commentId: updated.id,
      wordId: updated.wordId,
      actorId: cmd.userId,
      lemma: updated.wordLemma,
    });

    return updated;
  }

  private async notifyModerators(input: {
    commentId: string;
    wordId: string;
    actorId: string;
    lemma: string | null;
  }): Promise<void> {
    if (!this.userRepo || (!this.inbox && !this.notifyUser)) return;
    try {
      const moderatorIds = await this.userRepo.listActiveIdsByRoles([
        ...COMMENT_IMAGE_MODERATOR_ROLES,
      ]);
      const recipients = moderatorIds.filter((id) => id !== input.actorId);
      if (recipients.length === 0) return;

      const lemma = input.lemma?.trim() || 'sebuah kata';
      const body = `Ada foto komentar di "${lemma}" yang menunggu pengecekan.`;
      const title = PENDING_TITLE;

      for (const userId of recipients) {
        if (this.inbox) {
          await this.inbox.execute({
            userId,
            type: 'comment_image_pending_review',
            targetKind: 'word',
            targetId: input.wordId,
            actorId: input.actorId,
            title,
            body,
            actionKind: 'word',
            actionValue: input.wordId,
          });
        }
        if (this.notifyUser) {
          await this.notifyUser.execute({
            userId,
            title,
            body,
            actorId: input.actorId,
            data: {
              type: 'comment_image_pending_review',
              target_kind: 'word',
              target_id: input.wordId,
              action_kind: 'word',
              action_value: input.wordId,
              comment_id: input.commentId,
            },
          });
        }
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          level: 'error',
          time: new Date().toISOString(),
          msg: 'comment image pending_review blast failed',
          comment_id: input.commentId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}
