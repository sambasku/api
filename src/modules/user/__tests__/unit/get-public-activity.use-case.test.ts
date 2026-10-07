import { describe, it, expect, vi } from 'vitest';
import { GetPublicActivityUseCase } from '../../application/use-cases/get-public-activity.use-case';
import { NotFoundError } from '@/shared/errors/app-error';
import type { PublicActivityItem } from '../../domain/entities/public-profile.entity';
import type { PublicUserRepository } from '../../domain/repositories/public-user.repository';

const actor = (
  id: string,
  kind: PublicActivityItem['kind'],
  at: Date,
  summary = '',
): PublicActivityItem => ({
  id,
  kind,
  occurredAt: at,
  wordId: 'w1',
  lemma: 'makatn',
  summary,
});

/** Mock event feed repo: halaman per kategori (merge = 1 key 'merged'). */
type FeedKey = 'contribution' | 'comment' | 'verification' | 'vote' | 'merged';
function eventFeed(pages: Partial<Record<FeedKey, PublicActivityItem[]>> = {}) {
  return {
    listPublicByActor: vi.fn(
      async (
        _actorId: string,
        category: FeedKey,
      ): Promise<{ items: PublicActivityItem[]; nextCursor: string | null; hasMore: boolean }> => ({
        items: pages[category] ?? [],
        nextCursor: null,
        hasMore: false,
      }),
    ),
  };
}

function userRepo() {
  return {
    findPublicByUsername: vi.fn().mockResolvedValue({
      id: 'u1',
      username: 'budi',
      role: 'contributor',
      joinedAt: new Date(),
      avatarUrl: null,
    }),
  } as unknown as PublicUserRepository;
}

describe('GetPublicActivityUseCase - dari activity_events (#86)', () => {
  it('404 jika user tidak ada', async () => {
    const repo = {
      findPublicByUsername: vi.fn().mockResolvedValue(null),
    } as unknown as PublicUserRepository;
    const uc = new GetPublicActivityUseCase(repo, eventFeed());
    await expect(uc.execute('tidakada')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('merge: 1 query mode merged, urutan desc diteruskan apa adanya (#103)', async () => {
    const now = Date.now();
    // Repo sudah ORDER BY (occurred_at, id) DESC global - data masuk terurut,
    // use-case tidak sort lagi (dulu: 4 panggilan + sort gabungan).
    const feed = eventFeed({
      merged: [
        actor('01M1', 'comment', new Date(now), 'Mengomentari kata'),
        actor('01V1', 'verification', new Date(now - 500), 'Memverifikasi kata'),
        actor('01C1', 'contribution', new Date(now - 1000), 'Menambahkan foto'),
        actor('01X1', 'vote', new Date(now - 2000), 'Mendukung kata'),
      ],
    });

    const page = await new GetPublicActivityUseCase(userRepo(), feed).execute('budi');
    expect(page.items).toHaveLength(4);
    expect(page.items.map((i) => i.kind)).toEqual([
      'comment',
      'verification',
      'contribution',
      'vote',
    ]);
    // Mode merge tanpa cursor.
    expect(page.nextCursor).toBeUndefined();
    // SATU panggilan 'merged' (dulu 4 kategori paralel = 4 subrequest).
    expect(feed.listPublicByActor).toHaveBeenCalledTimes(1);
    expect(feed.listPublicByActor).toHaveBeenCalledWith('u1', 'merged', 20);
  });

  it('mode terfilter: teruskan limit + cursor ke repo event, kembalikan meta cursor', async () => {
    const feed = eventFeed({ comment: [actor('01M1', 'comment', new Date(), 'Mengomentari kata')] });
    const result = await new GetPublicActivityUseCase(userRepo(), feed).execute('budi', {
      kind: 'comment',
      limit: 20,
      cursor: '01EVENT0000000000000000000',
    });

    expect(feed.listPublicByActor).toHaveBeenCalledWith(
      'u1',
      'comment',
      20,
      '01EVENT0000000000000000000',
    );
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });
});
