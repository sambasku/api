import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '@/shared/errors/app-error';
import { RollbackWordImportSessionUseCase } from '../../application/use-cases/rollback-word-import-session.use-case';
import type { WordImportSession } from '../../domain/entities/word-import-session.entity';

function baseSession(overrides: Partial<WordImportSession> = {}): WordImportSession {
  return {
    id: '01IMPORTSESSIONROLLBACK01',
    triggeredBy: '01ADMINUSER000000000000001',
    triggeredByUsername: 'admin',
    triggeredByDisplayName: 'Admin',
    attributedTo: '01ANONIM000000000000000000',
    attributedToUsername: 'Anonim',
    attributedToDisplayName: 'Anonim',
    sourceLabel: 'Kontribusi massal web',
    supportName: 'Budi',
    supportType: 'other',
    supportAddress: null,
    supportTitle: null,
    supportDesc: null,
    claimedBy: null,
    claimedByUsername: null,
    claimedByDisplayName: null,
    claimedAt: null,
    status: 'completed',
    total: 2,
    createdCount: 2,
    duplicatesCount: 0,
    meaningsAddedCount: 0,
    invalidCount: 0,
    items: [
      { lemma: 'a', outcome: 'created', meanings_added: 1, word_id: '01WA' },
      { lemma: 'b', outcome: 'created', meanings_added: 1, word_id: '01WB' },
    ],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    finishedAt: new Date('2026-01-01T00:01:00.000Z'),
    rolledBackAt: null,
    rolledBackBy: null,
    ...overrides,
  };
}

describe('RollbackWordImportSessionUseCase', () => {
  it('soft-delete by session + tandai rolled_back + audit', async () => {
    const session = baseSession();
    const rolled = baseSession({
      rolledBackAt: new Date('2026-01-02T00:00:00.000Z'),
      rolledBackBy: '01ADMINUSER000000000000001',
    });
    const sessionRepo = {
      findById: vi.fn().mockResolvedValue(session),
      markRolledBack: vi.fn().mockResolvedValue(rolled),
      upsert: vi.fn(),
      list: vi.fn(),
      claim: vi.fn(),
    };
    const wordRepo = {
      softDeleteByImportSessionId: vi.fn().mockResolvedValue(2),
    };
    const auditRepo = {
      record: vi.fn().mockResolvedValue(undefined),
    };
    const useCase = new RollbackWordImportSessionUseCase(
      sessionRepo as never,
      wordRepo as never,
      auditRepo as never,
    );

    const result = await useCase.execute({
      sessionId: session.id,
      actorId: '01ADMINUSER000000000000001',
      requestId: 'req-1',
    });

    expect(result.deleted_count).toBe(2);
    expect(wordRepo.softDeleteByImportSessionId).toHaveBeenCalledWith(
      session.id,
      '01ADMINUSER000000000000001',
    );
    expect(sessionRepo.markRolledBack).toHaveBeenCalledWith(
      session.id,
      '01ADMINUSER000000000000001',
    );
    expect(auditRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'import_session_rollback',
        entityType: 'word_import_session',
        entityId: session.id,
        newData: expect.objectContaining({ deleted_count: 2 }),
      }),
    );
  });

  it('idempotent bila sudah rolled_back', async () => {
    const session = baseSession({
      rolledBackAt: new Date('2026-01-02T00:00:00.000Z'),
      rolledBackBy: '01ADMINUSER000000000000001',
    });
    const sessionRepo = {
      findById: vi.fn().mockResolvedValue(session),
      markRolledBack: vi.fn(),
    };
    const wordRepo = { softDeleteByImportSessionId: vi.fn() };
    const auditRepo = { record: vi.fn() };
    const useCase = new RollbackWordImportSessionUseCase(
      sessionRepo as never,
      wordRepo as never,
      auditRepo as never,
    );

    const result = await useCase.execute({
      sessionId: session.id,
      actorId: '01ADMINUSER000000000000001',
    });

    expect(result.deleted_count).toBe(0);
    expect(wordRepo.softDeleteByImportSessionId).not.toHaveBeenCalled();
    expect(sessionRepo.markRolledBack).not.toHaveBeenCalled();
    expect(auditRepo.record).not.toHaveBeenCalled();
  });

  it('404 jika sesi tidak ada', async () => {
    const useCase = new RollbackWordImportSessionUseCase(
      { findById: vi.fn().mockResolvedValue(null) } as never,
      { softDeleteByImportSessionId: vi.fn() } as never,
      { record: vi.fn() } as never,
    );
    await expect(
      useCase.execute({ sessionId: '01MISSING', actorId: '01ADMIN' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
