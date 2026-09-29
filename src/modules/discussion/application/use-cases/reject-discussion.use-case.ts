import { NotFoundError, ValidationError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { ImageStoragePort } from '@/modules/image/application/ports/image-storage.port';
import type { PronunciationStoragePort } from '@/modules/word/application/ports/pronunciation-storage.port';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import type { Discussion } from '../../domain/entities/discussion.entity';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';

export interface RejectDiscussionCommand {
  id: string;
  actorId: string;
  note: string;
  requestId?: string | null;
}

export class RejectDiscussionUseCase {
  constructor(
    private readonly repo: DiscussionRepository,
    private readonly imageStorage: ImageStoragePort,
    private readonly auditRepo: AuditLogRepository,
    private readonly inbox?: RecordInboxNotificationUseCase,
    private readonly audioStorage?: PronunciationStoragePort,
  ) {}

  async execute(cmd: RejectDiscussionCommand): Promise<Discussion> {
    const note = cmd.note.trim();
    if (note.length < 1) {
      throw new ValidationError([{ field: 'note', message: 'Alasan penolakan wajib diisi' }]);
    }
    if (note.length > 2000) {
      throw new ValidationError([{ field: 'note', message: 'Alasan penolakan maksimal 2000 karakter' }]);
    }

    const existing = await this.repo.findById(cmd.id);
    if (!existing || existing.status !== 'pending_review') {
      throw new NotFoundError('DISCUSSION_NOT_FOUND', 'Diskusi tidak ditemukan');
    }

    for (const img of existing.images) {
      // deleteFile ImageKit sudah best-effort (log internal, tidak lempar)
      await this.imageStorage.deleteFile(img.providerFileId);
    }

    if (existing.audio?.providerFileId && existing.audio.sha && this.audioStorage) {
      try {
        await this.audioStorage.delete(
          existing.audio.providerFileId,
          existing.audio.sha,
        );
      } catch {
        // best-effort
      }
    }

    const updated = await this.repo.updateStatus({
      id: existing.id,
      fromStatus: 'pending_review',
      toStatus: 'rejected',
      actorId: cmd.actorId,
      rejectionNote: note,
      images: existing.images.map((img) => ({
        ...img,
        // Staging sudah dihapus; kosongkan URL privat agar tidak bocor di admin lama
        url: '',
      })),
    });
    if (!updated) {
      throw new NotFoundError('DISCUSSION_NOT_FOUND', 'Diskusi tidak ditemukan');
    }

    await this.auditRepo.record({
      userId: cmd.actorId,
      action: 'update',
      entityType: 'discussion',
      entityId: updated.id,
      oldData: { status: existing.status },
      newData: { status: updated.status, rejection_note: note },
      requestId: cmd.requestId ?? null,
    });

    await this.inbox?.execute({
      userId: existing.userId,
      type: 'discussion_rejected',
      targetKind: 'discussion',
      targetId: updated.id,
      body: note,
      actorId: cmd.actorId,
    });

    return updated;
  }
}
