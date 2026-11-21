import { describe, it, expect, vi } from 'vitest';
import {
  MarkUsahaVisitUseCase,
  UnmarkUsahaVisitUseCase,
} from '../../application/use-cases/usaha-visit.use-cases';
import type { UsahaVisitRepository } from '../../domain/repositories/usaha-visit.repository';

function repoMock(over: Partial<UsahaVisitRepository> = {}): UsahaVisitRepository {
  return {
    findPublishedUsaha: vi.fn().mockResolvedValue({
      id: '01USAHAVISITTEST00000001',
      name: 'Warung Test',
      slug: 'warung-test',
      publishStatus: 'published',
    }),
    mark: vi.fn().mockResolvedValue({ visitCount: 1, viewerVisited: true }),
    unmark: vi.fn().mockResolvedValue({ visitCount: 0, viewerVisited: false }),
    countByUsahaIds: vi.fn().mockResolvedValue(new Map()),
    viewerVisitedByUsahaIds: vi.fn().mockResolvedValue(new Set()),
    listByUsahaId: vi.fn(),
    ...over,
  };
}

describe('MarkUsahaVisitUseCase', () => {
  it('menolak usaha tidak published', async () => {
    const repo = repoMock({
      findPublishedUsaha: vi.fn().mockResolvedValue(null),
    });
    await expect(
      new MarkUsahaVisitUseCase(repo).execute('user1', '01USAHAVISITTEST00000001'),
    ).rejects.toMatchObject({ errorCode: 'USAHA_NOT_FOUND' });
  });

  it('menulis activity saat mark pertama kali', async () => {
    const repo = repoMock({
      viewerVisitedByUsahaIds: vi.fn().mockResolvedValue(new Set()),
    });
    const activity = { safe: vi.fn().mockResolvedValue(undefined) };
    await new MarkUsahaVisitUseCase(repo, activity as never).execute(
      'user1',
      '01USAHAVISITTEST00000001',
    );
    expect(activity.safe).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'usaha_visited',
        dedupeKey: 'usaha.visit:user1:01USAHAVISITTEST00000001',
        actorId: 'user1',
        payload: 'Pernah bertransaksi di "Warung Test"',
      }),
    );
  });
});

describe('UnmarkUsahaVisitUseCase', () => {
  it('menyembunyikan activity hanya jika sebelumnya visited', async () => {
    const repo = repoMock({
      viewerVisitedByUsahaIds: vi
        .fn()
        .mockResolvedValue(new Set(['01USAHAVISITTEST00000001'])),
    });
    const activity = { safe: vi.fn().mockResolvedValue(undefined) };
    await new UnmarkUsahaVisitUseCase(repo, activity as never).execute(
      'user1',
      '01USAHAVISITTEST00000001',
    );
    expect(activity.safe).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'usaha_visited',
        hidden: true,
      }),
    );
  });

  it('tidak menulis activity jika belum visited', async () => {
    const repo = repoMock({
      viewerVisitedByUsahaIds: vi.fn().mockResolvedValue(new Set()),
    });
    const activity = { safe: vi.fn().mockResolvedValue(undefined) };
    await new UnmarkUsahaVisitUseCase(repo, activity as never).execute(
      'user1',
      '01USAHAVISITTEST00000001',
    );
    expect(activity.safe).not.toHaveBeenCalled();
  });
});