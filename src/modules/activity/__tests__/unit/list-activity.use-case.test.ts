import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '@/shared/errors/app-error';
import type { ActivityItem } from '../../domain/entities/activity-item.entity';
import type { ActivityRepository } from '../../domain/repositories/activity.repository';
import { encodeActivityCursor } from '../../domain/merge-activity';
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

function emptyRepo(overrides: Partial<ActivityRepository> = {}): ActivityRepository {
  return {
    listRecentWords: vi.fn().mockResolvedValue([]),
    listRecentComments: vi.fn().mockResolvedValue([]),
    listRecentVotes: vi.fn().mockResolvedValue([]),
    listRecentDiscussions: vi.fn().mockResolvedValue([]),
    listRecentApprovedContributions: vi.fn().mockResolvedValue([]),
    listRecentVisibleSearchMisses: vi.fn().mockResolvedValue([]),
    listRecentWelcomes: vi.fn().mockResolvedValue([]),
    listRecentCardShares: vi.fn().mockResolvedValue([]),
    listRecentAppliedSuggestions: vi.fn().mockResolvedValue([]),
    recordCardShare: vi.fn().mockResolvedValue('recorded'),
    ...overrides,
  };
}

describe('ListActivityUseCase - sensor blocklist', () => {
  it('sensor komentar, buang search-miss kena blocklist, sertakan share + usulan', async () => {
    const repo = emptyRepo({
      listRecentComments: vi.fn().mockResolvedValue([
        { ...item('comment', 'c1', '2026-09-28T11:00:00.000Z'), body: 'dasar bodoh kau' },
      ]),
      listRecentVisibleSearchMisses: vi.fn().mockResolvedValue([
        { ...item('search_miss', 's1', '2026-09-28T10:00:00.000Z'), body: 'Mencari "bodoh"' },
        { ...item('search_miss', 's2', '2026-09-28T09:00:00.000Z'), body: 'Mencari "pinggan"' },
      ]),
      listRecentCardShares: vi.fn().mockResolvedValue([
        item('card_share', 'k1', '2026-09-28T08:00:00.000Z'),
      ]),
      listRecentAppliedSuggestions: vi.fn().mockResolvedValue([
        item('suggestion', 'g1', '2026-09-28T07:00:00.000Z'),
      ]),
    });
    const blocklist = { listAllActiveWords: vi.fn().mockResolvedValue(['bodoh']) };
    const page = await new ListActivityUseCase(repo, blocklist).execute({ limit: 20 });
    expect(page.items.map((i) => i.id)).toEqual([
      'comment:c1',
      'search_miss:s2',
      'card_share:k1',
      'suggestion:g1',
    ]);
    expect(page.items[0].body).not.toContain('bodoh');
  });
});

describe('ListActivityUseCase', () => {
  it('menggabungkan semua sumber lalu cap', async () => {
    const repo = emptyRepo({
      listRecentWords: vi.fn().mockResolvedValue([
        item('word', 'w1', '2026-09-28T10:00:00.000Z'),
      ]),
      listRecentComments: vi.fn().mockResolvedValue([
        item('comment', 'c1', '2026-09-28T11:00:00.000Z'),
      ]),
      listRecentVotes: vi.fn().mockResolvedValue([
        item('vote', 'v1', '2026-09-28T12:00:00.000Z'),
      ]),
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
    });

    const useCase = new ListActivityUseCase(repo);
    const page = await useCase.execute({ limit: 20 });

    expect(page.items.map((r) => r.kind)).toEqual([
      'vote',
      'comment',
      'word',
      'word_image',
      'search_miss',
      'welcome',
    ]);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
    expect(repo.listRecentWords).toHaveBeenCalledWith(8, undefined, undefined);
    expect(repo.listRecentApprovedContributions).toHaveBeenCalled();
    expect(repo.listRecentWelcomes).toHaveBeenCalled();
  });

  it('cursor rusak → ValidationError', async () => {
    const useCase = new ListActivityUseCase(emptyRepo());
    await expect(useCase.execute({ limit: 20, cursor: 'bukan-cursor' })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('halaman berikutnya meneruskan before ke repo', async () => {
    const cursor = encodeActivityCursor({
      createdAt: new Date('2026-09-28T12:00:00.000Z'),
      id: 'vote:v1',
    });
    const repo = emptyRepo({
      listRecentVotes: vi.fn().mockResolvedValue([
        item('vote', 'v0', '2026-09-28T11:00:00.000Z'),
      ]),
    });
    const useCase = new ListActivityUseCase(repo);
    const page = await useCase.execute({ limit: 20, cursor });

    expect(page.items).toHaveLength(1);
    expect(page.items[0].id).toBe('vote:v0');
    expect(repo.listRecentVotes).toHaveBeenCalledWith(
      8,
      expect.objectContaining({
        id: 'vote:v1',
        createdAt: expect.any(Date),
      }),
      undefined,
    );
  });

  it('has_more + next_cursor saat pool melebihi limit', async () => {
    const votes = Array.from({ length: 4 }, (_, i) =>
      item('vote', `v${i}`, `2026-09-28T${String(20 - i).padStart(2, '0')}:00:00.000Z`),
    );
    const comments = Array.from({ length: 4 }, (_, i) =>
      item(
        'comment',
        `c${i}`,
        `2026-09-28T${String(15 - i).padStart(2, '0')}:00:00.000Z`,
      ),
    );
    const repo = emptyRepo({
      listRecentVotes: vi.fn().mockResolvedValue(votes),
      listRecentComments: vi.fn().mockResolvedValue(comments),
    });
    const useCase = new ListActivityUseCase(repo);
    const page = await useCase.execute({ limit: 5 });

    expect(page.items).toHaveLength(5);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBeTruthy();
  });
});

describe('ListActivityUseCase - excludeUserId diteruskan ke semua sumber', () => {
  it('meneruskan excludeUserId ke 8 sumber yang punya kolom user', async () => {
    const repo = emptyRepo();
    await new ListActivityUseCase(repo).execute({
      limit: 20,
      excludeUserId: '01SELF',
    });

    expect(repo.listRecentWords).toHaveBeenCalledWith(8, undefined, '01SELF');
    expect(repo.listRecentComments).toHaveBeenCalledWith(8, undefined, '01SELF');
    expect(repo.listRecentVotes).toHaveBeenCalledWith(8, undefined, '01SELF');
    expect(repo.listRecentDiscussions).toHaveBeenCalledWith(8, undefined, '01SELF');
    expect(repo.listRecentWelcomes).toHaveBeenCalledWith(8, undefined, '01SELF');
    expect(repo.listRecentCardShares).toHaveBeenCalledWith(8, undefined, '01SELF');
    expect(repo.listRecentAppliedSuggestions).toHaveBeenCalledWith(
      8,
      undefined,
      '01SELF',
    );
    expect(repo.listRecentApprovedContributions).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Number),
      undefined,
      '01SELF',
    );
  });

  it('search-miss TIDAK diberi excludeUserId (kolom user tidak ada)', async () => {
    const repo = emptyRepo();
    await new ListActivityUseCase(repo).execute({
      limit: 20,
      excludeUserId: '01SELF',
    });

    // Kalau argumen ketiga ikut dikirim, panggilan 2-argumen ini akan gagal.
    expect(repo.listRecentVisibleSearchMisses).toHaveBeenCalledWith(8, undefined);
  });

  it('tanpa excludeUserId → undefined di semua sumber (feed publik utuh)', async () => {
    const repo = emptyRepo();
    await new ListActivityUseCase(repo).execute({ limit: 20 });

    expect(repo.listRecentWords).toHaveBeenCalledWith(8, undefined, undefined);
    expect(repo.listRecentComments).toHaveBeenCalledWith(8, undefined, undefined);
    expect(repo.listRecentWelcomes).toHaveBeenCalledWith(8, undefined, undefined);
  });
});
