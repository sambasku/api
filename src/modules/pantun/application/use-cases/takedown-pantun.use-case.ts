import { NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { PronunciationStoragePort } from '@/modules/word/application/ports/pronunciation-storage.port';
import type { Pantun } from '../../domain/entities/pantun.entity';
import type { PantunRepository } from '../../domain/repositories/pantun.repository';

export class TakedownPantunUseCase {
  constructor(
    private readonly repo: PantunRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly audioStorage?: PronunciationStoragePort,
  ) {}

  async execute(cmd: {
    id: string;
    actorId: string;
    requestId?: string | null;
  }): Promise<Pantun> {
    const existing = await this.repo.findById(cmd.id);
    const row = await this.repo.takedown(cmd.id, cmd.actorId);
    if (!row) {
      throw new NotFoundError('PANTUN_NOT_FOUND', 'Pantun tidak ditemukan');
    }
    if (existing?.audio?.providerFileId && existing.audio.sha && this.audioStorage) {
      try {
        await this.audioStorage.delete(
          existing.audio.providerFileId,
          existing.audio.sha,
        );
      } catch {
        // best-effort
      }
    }
    await this.auditRepo.record({
      userId: cmd.actorId,
      action: 'takedown',
      entityType: 'pantun',
      entityId: cmd.id,
      oldData: { status: 'published' },
      newData: { status: 'taken_down' },
      requestId: cmd.requestId ?? null,
    });
    return row;
  }
}
