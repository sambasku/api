import { NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { WordRepository } from '../../domain/repositories/word.repository';
import type { WordImportSessionRepository } from '../../domain/repositories/word-import-session.repository';
import type { WordImportSession } from '../../domain/entities/word-import-session.entity';

export type RollbackImportSessionResult = {
  session_id: string;
  deleted_count: number;
  session: WordImportSession;
};

/**
 * Soft-delete semua kata yang dibuat oleh sesi impor (import_session_id).
 * Idempotent: sesi yang sudah rolled_back → deleted_count 0.
 */
export class RollbackWordImportSessionUseCase {
  constructor(
    private readonly sessionRepo: WordImportSessionRepository,
    private readonly wordRepo: WordRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(input: {
    sessionId: string;
    actorId: string;
    requestId?: string | null;
  }): Promise<RollbackImportSessionResult> {
    const session = await this.sessionRepo.findById(input.sessionId);
    if (!session) {
      throw new NotFoundError('NOT_FOUND', 'Sesi impor tidak ditemukan');
    }

    if (session.rolledBackAt) {
      return {
        session_id: session.id,
        deleted_count: 0,
        session,
      };
    }

    const deletedCount = await this.wordRepo.softDeleteByImportSessionId(
      session.id,
      input.actorId,
    );
    const updated = await this.sessionRepo.markRolledBack(session.id, input.actorId);

    await this.auditRepo.record({
      userId: input.actorId,
      action: 'import_session_rollback',
      entityType: 'word_import_session',
      entityId: session.id,
      newData: {
        deleted_count: deletedCount,
        source_label: session.sourceLabel,
        support_name: session.supportName,
        created_count: session.createdCount,
      },
      requestId: input.requestId ?? null,
    });

    return {
      session_id: updated.id,
      deleted_count: deletedCount,
      session: updated,
    };
  }
}
