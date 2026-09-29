import { describe, expect, it, vi } from 'vitest';
import type { ActivityItem } from '../../domain/entities/activity-item.entity';
import type { ActivityRepository } from '../../domain/repositories/activity.repository';
import { ListActivityUseCase } from '../../application/use-cases/list-activity.use-case';

function item(
  kind: ActivityItem['kind'],
  id: string,
  at: string,
): ActivityItem {
  return {
    id: `${kind}:${id}`,
    kind,
    createdAt: new Date(at),
    actor: { username: 'u', displayName: 'U', avatarUrl: null },
    body: kind,
    subtitle: null,
    target: null,
  };
}

describe('ListActivityUseCase', () => {
  it('menggabungkan semua sumber lalu cap', async () => {
    const repo: ActivityRepository = {
      listRecentWords: vi.fn().mockResolvedValue([
        item('word', 'w1', '2026-09-28T10:00:00.000Z'),
      ]),
      listRecentComments: vi.fn().mockResolvedValue([
        item('comment', 'c1', '2026-09-28T11:00:00.000Z'),
      ]),
      listRecentVotes: vi.fn().mockResolvedValue([
        item('vote', 'v1', '2026-09-28T12:00:00.000Z'),
      ]),
      listRecentDiscussions: vi.fn().mockResolvedValue([]),
      listRecentApprovedContributions: vi.fn().mockResolvedValue([
        item('word_image', 'i1', '2026-09-28T09:00:00.000Z'),
      ]),
      listRecentVisibleSearchMisses: vi.fn().mockResolvedValue([
        {
          ...item('search_miss', 's1', '2026-09-28T08:00:00.000Z'),
          actor: null,
        },
      ]),
      listRecentWelcomes: vi.fn().mockResolvedValue([
        item('welcome', 'u1', '2026-09-28T07:00:00.000Z'),
      ]),
    };

    const useCase = new ListActivityUseCase(repo);
    const result = await useCase.execute(20);

    expect(result.map((r) => r.kind)).toEqual([
      'vote',
      'comment',
      'word',
      'word_image',
      'search_miss',
      'welcome',
    ]);
    expect(repo.listRecentWords).toHaveBeenCalled();
    expect(repo.listRecentApprovedContributions).toHaveBeenCalled();
    expect(repo.listRecentWelcomes).toHaveBeenCalled();
  });
});
