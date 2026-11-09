import { ForbiddenError, NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { PronunciationStoragePort } from '@/modules/word/application/ports/pronunciation-storage.port';
import type { PantunRepository } from '../../domain/repositories/pantun.repository';

/**
 * Hapus pantun sendiri (soft: status deleted_by_author).
 * Verifikator memakai takedown, bukan endpoint ini.
 * Audio GitHub dihapus best-effort.
 */
export class DeletePantunUseCase {
  constructor(
    private readonly repo: PantunRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly audioStorage?: PronunciationStoragePort,
  ) {}

  async execute(cmd: {
    id: string;
    actorId: string;
    requestId?: string | null;
  }): Promise<void> {
    const pantun = await this.repo.findById(cmd.id);
    if (!pantun || pantun.status !== 'published') {
      throw new NotFoundError('PANTUN_NOT_FOUND', 'Pantun tidak ditemukan');
    }

    if (pantun.userId !== cmd.actorId) {
      throw new ForbiddenError(
        'FORBIDDEN',
        'Hanya penulis yang dapat menghapus pantun ini. Verifikator memakai takedown.',
      );
    }

    const ok = await this.repo.markDeletedByAuthor(cmd.id, cmd.actorId);
    if (!ok) {
      throw new NotFoundError('PANTUN_NOT_FOUND', 'Pantun tidak ditemukan');
    }

    await this.bestEffortDeleteAudio(pantun.audio);

    await this.auditRepo.record({
      userId: cmd.actorId,
      action: 'delete',
      entityType: 'pantun',
      entityId: cmd.id,
      oldData: { status: 'published' },
      newData: { status: 'deleted_by_author' },
      requestId: cmd.requestId ?? null,
    });
  }

  private async bestEffortDeleteAudio(
    audio: { providerFileId: string; sha: string | null } | null,
  ): Promise<void> {
    if (!audio?.providerFileId || !audio.sha || !this.audioStorage) return;
    try {
      await this.audioStorage.delete(audio.providerFileId, audio.sha);
    } catch {
      // best-effort
    }
  }
}
