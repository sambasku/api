import { describe, it, expect, vi } from 'vitest';
import {
  MarkPlaceVisitUseCase,
  UnmarkPlaceVisitUseCase,
} from '../../application/use-cases/place-visit.use-cases';
import type { PlaceVisitRepository } from '../../domain/repositories/place-visit.repository';

function repoMock(over: Partial<PlaceVisitRepository> = {}): PlaceVisitRepository {
  return {
    findPublishedPlace: vi.fn().mockResolvedValue({
      id: '01PLACEVISITTEST00000001',
      name: 'Air Terjun Test',
      slug: 'air-terjun-test',
      status: 'published',
    }),
    mark: vi.fn().mockResolvedValue({ visitCount: 1, viewerVisited: true }),
    unmark: vi.fn().mockResolvedValue({ visitCount: 0, viewerVisited: false }),
    countByPlaceIds: vi.fn().mockResolvedValue(new Map()),
    viewerVisitedByPlaceIds: vi.fn().mockResolvedValue(new Set()),
    listByPlaceId: vi.fn(),
    ...over,
  };
}

describe('MarkPlaceVisitUseCase', () => {
  it('menolak wisata tidak published', async () => {
    const repo = repoMock({
      findPublishedPlace: vi.fn().mockResolvedValue(null),
    });
    await expect(
      new MarkPlaceVisitUseCase(repo).execute('user1', '01PLACEVISITTEST00000001'),
    ).rejects.toMatchObject({ errorCode: 'PLACE_NOT_FOUND' });
  });

  it('menulis activity saat mark pertama kali', async () => {
    const repo = repoMock({
      viewerVisitedByPlaceIds: vi.fn().mockResolvedValue(new Set()),
    });
    const activity = { safe: vi.fn().mockResolvedValue(undefined) };
    await new MarkPlaceVisitUseCase(repo, activity as never).execute(
      'user1',
      '01PLACEVISITTEST00000001',
    );
    expect(activity.safe).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'place_visited',
        dedupeKey: 'place.visit:user1:01PLACEVISITTEST00000001',
        actorId: 'user1',
        payload: 'Pernah singgah di "Air Terjun Test"',
      }),
    );
  });
});

describe('UnmarkPlaceVisitUseCase', () => {
  it('menyembunyikan activity hanya jika sebelumnya visited', async () => {
    const repo = repoMock({
      viewerVisitedByPlaceIds: vi
        .fn()
        .mockResolvedValue(new Set(['01PLACEVISITTEST00000001'])),
    });
    const activity = { safe: vi.fn().mockResolvedValue(undefined) };
    await new UnmarkPlaceVisitUseCase(repo, activity as never).execute(
      'user1',
      '01PLACEVISITTEST00000001',
    );
    expect(activity.safe).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'place_visited',
        hidden: true,
      }),
    );
  });

  it('tidak menulis activity jika belum visited', async () => {
    const repo = repoMock({
      viewerVisitedByPlaceIds: vi.fn().mockResolvedValue(new Set()),
    });
    const activity = { safe: vi.fn().mockResolvedValue(undefined) };
    await new UnmarkPlaceVisitUseCase(repo, activity as never).execute(
      'user1',
      '01PLACEVISITTEST00000001',
    );
    expect(activity.safe).not.toHaveBeenCalled();
  });
});