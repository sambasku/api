import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '@/shared/errors/app-error';
import type { ActivityItem } from '../../domain/entities/activity-item.entity';
import type { ActivityEventKind } from '../../domain/entities/activity-event.entity';
import {
  encodeActivityCursor,
  FEED_CATEGORY_KINDS,
  type ActivityCursor,
} from '../../domain/merge-activity';
import { ListActivityUseCase } from '../../application/use-cases/list-activity.use-case';

function item(kind: ActivityItem['kind'], id: string, at: string): ActivityItem {
  return {
    id: `${kind}:${id}`,
    kind,
    createdAt: new Date(at),
    actor: { username: 'u', displayName: 'U', avatarUrl: null, isVerifier: false },
    body: kind,
    subtitle: null,
    target: null,
  };
}

function feedRepo(pages: ActivityItem[][]) {
  let call = 0;
  const listFeed = vi.fn(
    async (
      _limit: number,
      _before?: ActivityCursor,
      _exclude?: string,
      _kinds?: ActivityEventKind[],
    ): Promise<ActivityItem[]> => {
      const page = pages[Math.min(call, pages.length - 1)];
      call += 1;
      return page;
    },
  );
  return { listFeed };
}

describe('ListActivityUseCase - feed dari activity_events', () => {
  it('kembalikan halaman + cursor dari event feed repo', async () => {
    const items = Array.from({ length: 3 }, (_, i) =>
      item('word', `w${i}`, `2026-09-28T11:0${i}:00.000Z`),
    );
    const repo = feedRepo([items]);
    const page = await new ListActivityUseCase(repo).execute({ limit: 2 });
    expect(page.items.map((i) => i.id)).toEqual(['word:w0', 'word:w1']);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe(
      encodeActivityCursor({
        createdAt: new Date('2026-09-28T11:01:00.000Z'),
        id: 'word:w1',
      }),
    );
  expect(repo.listFeed).toHaveBeenCalledWith(3, undefined, undefined, null);
});

  it('halaman terakhir: hasMore false, cursor null', async () => {
    const items = [item('comment', 'c1', '2026-09-28T11:00:00.000Z')];
    const page = await new ListActivityUseCase(feedRepo([items])).execute({ limit: 20 });
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('cursor lanjut ke halaman berikutnya (keyset diteruskan)', async () => {
    const items = [
      item('vote', 'v1', '2026-09-28T10:00:00.000Z'),
      item('vote', 'v2', '2026-09-28T09:00:00.000Z'),
    ];
    const repo = feedRepo([items]);
    const cursor = encodeActivityCursor({
      createdAt: new Date('2026-09-28T11:00:00.000Z'),
      id: 'word:w0',
    });
    await new ListActivityUseCase(repo).execute({ limit: 2, cursor });
    const [limit, before, exclude] = repo.listFeed.mock.calls[0];
    expect(limit).toBe(3);
    expect(before?.createdAt).toEqual(new Date('2026-09-28T11:00:00.000Z'));
    expect(exclude).toBeUndefined();
  });

  it('excludeUserId diteruskan ke repo', async () => {
    const repo = feedRepo([[]]);
    await new ListActivityUseCase(repo).execute({ limit: 20, excludeUserId: 'u1' });
  expect(repo.listFeed).toHaveBeenCalledWith(21, undefined, 'u1', null);
});

  it('cursor rusak -> ValidationError', async () => {
    await expect(
      new ListActivityUseCase(feedRepo([[]])).execute({ cursor: 'bukan-base64-json' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

// #193: filter kategori chips feed beranda.
describe('ListActivityUseCase - kategori feed (#193)', () => {
  it('kategori "all" (default) TANPA filter: kinds null ke repo', async () => {
    const repo = feedRepo([[]]);
    await new ListActivityUseCase(repo).execute({});
    expect(repo.listFeed).toHaveBeenCalledWith(21, undefined, undefined, null);
  });

  it('kategori "joined" -> kinds [user_joined]', async () => {
    const repo = feedRepo([[]]);
    await new ListActivityUseCase(repo).execute({ category: 'joined' });
    expect(repo.listFeed).toHaveBeenCalledWith(
      21,
      undefined,
      undefined,
      ['user_joined'],
    );
  });

  it('kategori "search_miss" -> kinds [search_miss]', async () => {
    const repo = feedRepo([[]]);
    await new ListActivityUseCase(repo).execute({ category: 'search_miss' });
    expect(repo.listFeed).toHaveBeenCalledWith(
      21,
      undefined,
      undefined,
      ['search_miss'],
    );
  });

  it('kategori "correction" = kontribusi media + usulan edit', async () => {
    const repo = feedRepo([[]]);
    await new ListActivityUseCase(repo).execute({ category: 'correction' });
    const kinds = repo.listFeed.mock.calls[0][3];
    expect(kinds).toContain('contribution_image');
    expect(kinds).toContain('suggestion_applied');
    // Bukan kategori kata baru / verifikasi.
    expect(kinds).not.toContain('word_created');
    expect(kinds).not.toContain('word_verified');
  });

  // JEBAKAN: [] = filter MATI diam-diam (repo cek kinds.length > 0).
  // Mengunci: 'all' HARUS null, bukan [].
  it('FEED_CATEGORY_KINDS.all === null (bukan [])', () => {
    expect(FEED_CATEGORY_KINDS['all']).toBeNull();
  });
});
