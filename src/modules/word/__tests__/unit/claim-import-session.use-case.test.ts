import { describe, expect, it, vi } from 'vitest';
import { CSV_IMPORTER_USER_ID } from '@/shared/constants/csv-importer';
import { ConflictError, NotFoundError } from '@/shared/errors/app-error';
import { ClaimWordImportSessionUseCase } from '../../application/use-cases/word-import-session.use-cases';
import type { WordImportSession } from '../../domain/entities/word-import-session.entity';

function baseSession(overrides: Partial<WordImportSession> = {}): WordImportSession {
  return {
    id: '01IMPORTSESSIONCLAIMTEST01',
    triggeredBy: '01ADMINUSER000000000000001',
    triggeredByUsername: 'admin',
    triggeredByDisplayName: 'Admin',
    attributedTo: CSV_IMPORTER_USER_ID,
    attributedToUsername: 'Pengimpor Data CSV',
    attributedToDisplayName: 'Pengimpor Data CSV',
    sourceLabel: 'data.csv',
    supportName: 'Kamus Online',
    supportType: 'web',
    supportAddress: 'https://example.com',
    supportTitle: 'Entri',
    supportDesc: null,
    claimedBy: null,
    claimedByUsername: null,
    claimedByDisplayName: null,
    claimedAt: null,
    status: 'completed',
    total: 2,
    createdCount: 1,
    duplicatesCount: 0,
    meaningsAddedCount: 1,
    invalidCount: 0,
    items: [
      { lemma: 'makatn', outcome: 'created', meanings_added: 1 },
      { lemma: 'nginum', outcome: 'meanings_added', meanings_added: 1 },
    ],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    finishedAt: new Date('2026-01-01T00:01:00.000Z'),
    rolledBackAt: null,
    rolledBackBy: null,
    ...overrides,
  };
}

describe('ClaimWordImportSessionUseCase', () => {
  it('mengklaim batch Pengimpor CSV ke user aktif', async () => {
    const session = baseSession();
    const claimed = baseSession({
      attributedTo: '01USERCLAIMTARGET00000001',
      attributedToUsername: 'penutur',
      attributedToDisplayName: 'Penutur',
      claimedBy: '01ADMINUSER000000000000001',
      claimedByUsername: 'admin',
      claimedByDisplayName: 'Admin',
      claimedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    const repo = {
      findById: vi.fn().mockResolvedValue(session),
      claim: vi.fn().mockResolvedValue(claimed),
      upsert: vi.fn(),
      list: vi.fn(),
      markRolledBack: vi.fn(),
    };
    const users = {
      findById: vi.fn().mockResolvedValue({ id: '01USERCLAIMTARGET00000001', isActive: true }),
    };
    const useCase = new ClaimWordImportSessionUseCase(repo, users);

    const result = await useCase.execute({
      sessionId: session.id,
      attributedTo: '01USERCLAIMTARGET00000001',
      claimedBy: '01ADMINUSER000000000000001',
    });

    expect(result.attributedTo).toBe('01USERCLAIMTARGET00000001');
    expect(repo.claim).toHaveBeenCalledWith({
      sessionId: session.id,
      fromUserId: CSV_IMPORTER_USER_ID,
      toUserId: '01USERCLAIMTARGET00000001',
      claimedBy: '01ADMINUSER000000000000001',
      createdLemmas: ['makatn'],
      meaningLemmas: ['nginum'],
    });
  });

  it('menolak klaim jika sesi sudah bukan Pengimpor CSV', async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue(
        baseSession({ attributedTo: '01USERCLAIMTARGET00000001' }),
      ),
      claim: vi.fn(),
      upsert: vi.fn(),
      list: vi.fn(),
      markRolledBack: vi.fn(),
    };
    const users = { findById: vi.fn() };
    const useCase = new ClaimWordImportSessionUseCase(repo, users);

    await expect(
      useCase.execute({
        sessionId: '01IMPORTSESSIONCLAIMTEST01',
        attributedTo: '01USERCLAIMTARGET00000001',
        claimedBy: '01ADMINUSER000000000000001',
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(repo.claim).not.toHaveBeenCalled();
  });

  it('menolak klaim ke Pengimpor CSV sendiri', async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue(baseSession()),
      claim: vi.fn(),
      upsert: vi.fn(),
      list: vi.fn(),
      markRolledBack: vi.fn(),
    };
    const users = {
      findById: vi.fn().mockResolvedValue({ id: CSV_IMPORTER_USER_ID, isActive: true }),
    };
    const useCase = new ClaimWordImportSessionUseCase(repo, users);

    await expect(
      useCase.execute({
        sessionId: '01IMPORTSESSIONCLAIMTEST01',
        attributedTo: CSV_IMPORTER_USER_ID,
        claimedBy: '01ADMINUSER000000000000001',
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('404 jika sesi tidak ada', async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue(null),
      claim: vi.fn(),
      upsert: vi.fn(),
      list: vi.fn(),
      markRolledBack: vi.fn(),
    };
    const useCase = new ClaimWordImportSessionUseCase(repo, { findById: vi.fn() });
    await expect(
      useCase.execute({
        sessionId: '01IMPORTSESSIONMISSING0001',
        attributedTo: '01USERCLAIMTARGET00000001',
        claimedBy: '01ADMINUSER000000000000001',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
