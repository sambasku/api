import { NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { PronunciationStoragePort } from '@/modules/word/application/ports/pronunciation-storage.port';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import type { Discussion } from '../../domain/entities/discussion.entity';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';

export interface TakedownDiscussionCommand {
  id: string;
  actorId: string;
  requestId?: string | null;
}

export class TakedownDiscussionUseCase {
  constructor(
    private readonly repo: DiscussionRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly inbox?: RecordInboxNotificationUseCase,
    private readonly audioStorage?: PronunciationStoragePort,
  ) {}

  async execute(cmd: TakedownDiscussionCommand): Promise<Discussion> {
    const existing = await this.repo.findById(cmd.id);
    if (!existing || existing.status !== 'published') {
      throw new NotFoundError('DISCUSSION_NOT_FOUND', 'Diskusi tidak ditemukan');
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
      fromStatus: 'published',
      toStatus: 'taken_down',
      actorId: cmd.actorId,
    });
    if (!updated) {
      throw new NotFoundError('DISCUSSION_NOT_FOUND', 'Diskusi tidak ditemukan');
    }

    await this.auditRepo.record({
      userId: cmd.actorId,
      action: 'takedown',
      entityType: 'discussion',
      entityId: updated.id,
      oldData: { status: existing.status },
      newData: { status: updated.status },
      requestId: cmd.requestId ?? null,
    });

    await this.inbox?.execute({
      userId: existing.userId,
      type: 'discussion_taken_down',
      targetKind: 'discussion',
      targetId: updated.id,
      actorId: cmd.actorId,
    });

    return updated;
  }
}
