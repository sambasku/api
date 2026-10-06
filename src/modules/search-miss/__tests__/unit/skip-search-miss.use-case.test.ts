import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SkipSearchMissUseCase } from '../../application/use-cases/skip-search-miss.use-case';
import type { SearchMiss } from '../../domain/entities/search-miss.entity';
import type { SearchMissRepository } from '../../domain/repositories/search-miss.repository';
import type { UserSkipRepository } from '@/modules/user-skip/infrastructure/user-skip.repository';

const miss: SearchMiss = {
  id: '01JDSEARCHMISS0000000000001',
  term: 'kalintiak',
  direction: 'lemma',
  hitCount: 3,
  lastSearchedAt: new Date('2026-09-16T10:00:00Z'),
  isFulfilled: false,
  isVisible: false,
  createdAt: new Date('2026-09-16T09:00:00Z'),
};

describe('SkipSearchMissUseCase', () => {
  let missRepo: { findById: ReturnType<typeof vi.fn> };
  let userSkipRepo: { record: ReturnType<typeof vi.fn> };
  let uc: SkipSearchMissUseCase;

  beforeEach(() => {
    missRepo = { findById: vi.fn().mockResolvedValue(miss) };
    userSkipRepo = { record: vi.fn().mockResolvedValue(undefined) };
    uc = new SkipSearchMissUseCase(
      missRepo as unknown as SearchMissRepository,
      userSkipRepo as unknown as UserSkipRepository,
    );
  });

  it('miss tidak ada / dismissed → 404, skip tidak dicatat', async () => {
    missRepo.findById.mockResolvedValue(null);
    await expect(
      uc.execute({ missId: miss.id, userId: 'user1' }),
    ).rejects.toMatchObject({ errorCode: 'SEARCH_MISS_NOT_FOUND' });
    expect(userSkipRepo.record).not.toHaveBeenCalled();
  });

  it('miss ada → record(userId, search_miss, missId)', async () => {
    await uc.execute({ missId: miss.id, userId: 'user1' });
    expect(userSkipRepo.record).toHaveBeenCalledWith('user1', 'search_miss', miss.id);
  });

  it('skip ulang idempotent - tidak error', async () => {
    userSkipRepo.record.mockResolvedValue(undefined);
    await uc.execute({ missId: miss.id, userId: 'user1' });
    await expect(uc.execute({ missId: miss.id, userId: 'user1' })).resolves
      .toBeUndefined();
    expect(userSkipRepo.record).toHaveBeenCalledTimes(2);
  });
});
