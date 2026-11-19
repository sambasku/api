import { describe, expect, it, vi } from 'vitest';
import { ListHotTopicsUseCase } from '../../application/list-hot-topics.use-case';
import type { HotTopicsRepository } from '../../domain/hot-topics.repository';
import type { HotTopicsResult } from '../../domain/hot-topic.entity';

const emptyMeta = { inWindow: 0, backfilled: 0, backfillUsed: false };
const empty: HotTopicsResult = {
  searched: { items: [], meta: emptyMeta },
  proposed: { items: [], meta: emptyMeta },
  nearThreshold: { items: [], meta: emptyMeta },
};

describe('ListHotTopicsUseCase', () => {
  it('default limit 10, cap max 10', async () => {
    const listAllTabs = vi.fn().mockResolvedValue(empty);
    const repo = { listAllTabs } as unknown as HotTopicsRepository;
    const uc = new ListHotTopicsUseCase(repo);

    await uc.execute({});
    expect(listAllTabs).toHaveBeenCalledWith(10);

    await uc.execute({ limit: 99 });
    expect(listAllTabs).toHaveBeenCalledWith(10);

    await uc.execute({ limit: 3 });
    expect(listAllTabs).toHaveBeenCalledWith(3);
  });
});
