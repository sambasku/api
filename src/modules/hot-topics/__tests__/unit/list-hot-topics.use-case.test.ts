import { describe, it, expect, vi } from 'vitest';
import { ListHotTopicsUseCase } from '../../application/list-hot-topics.use-case';
import type { HotTopicsRepository } from '../../domain/hot-topics.repository';
import type { HotTopicsResult } from '../../domain/hot-topic.entity';

const emptyMeta = { inWindow: 0, backfilled: 0, backfillUsed: false };
const empty: HotTopicsResult = {
  searched: { items: [], meta: emptyMeta },
  proposed: { items: [], meta: emptyMeta },
  viewed: { items: [], meta: emptyMeta },
  check: { items: [], meta: emptyMeta },
};

describe('ListHotTopicsUseCase', () => {
  it('meneruskan limit (default 10, max 10)', async () => {
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

  it('menyaring Dicari + Usulan + Hits + Cek lewat wordlist', async () => {
    const listAllTabs = vi.fn().mockResolvedValue({
      searched: {
        items: [
          {
            kind: 'search_miss',
            id: '1',
            term: 'spam',
            direction: 'lemma',
            hitCount: 3,
            lastSearchedAt: new Date(),
            inWindow: true,
          },
          {
            kind: 'search_miss',
            id: '2',
            term: 'makatn',
            direction: 'lemma',
            hitCount: 2,
            lastSearchedAt: new Date(),
            inWindow: true,
          },
        ],
        meta: emptyMeta,
      },
      proposed: {
        items: [
          {
            kind: 'contribution',
            id: 'c1',
            wordId: 'w-spam',
            lemma: 'spam',
            createdAt: new Date(),
            inWindow: true,
          },
          {
            kind: 'contribution',
            id: 'c2',
            wordId: 'w-ok',
            lemma: 'nganga',
            createdAt: new Date(),
            inWindow: true,
          },
        ],
        meta: emptyMeta,
      },
      viewed: {
        items: [
          {
            kind: 'word_view',
            wordId: 'w1',
            lemma: 'spam',
            viewCount: 9,
            lastViewedDay: '2026-11-19',
            inWindow: true,
          },
        ],
        meta: emptyMeta,
      },
      check: {
        items: [
          {
            kind: 'meaning_downvote',
            meaningId: 'm-spam',
            wordId: 'w-spam',
            lemma: 'spam',
            definitionPreview: 'buruk',
            downvotes: 2,
            lastDownvotedAt: new Date(),
            inWindow: true,
          },
          {
            kind: 'meaning_downvote',
            meaningId: 'm-ok',
            wordId: 'w-ok',
            lemma: 'nganga',
            definitionPreview: 'terbuka',
            downvotes: 1,
            lastDownvotedAt: new Date(),
            inWindow: true,
          },
        ],
        meta: emptyMeta,
      },
    } satisfies HotTopicsResult);
    const blocklist = {
      findActiveWordSet: vi.fn().mockResolvedValue(new Set(['spam'])),
    };
    const uc = new ListHotTopicsUseCase(
      { listAllTabs } as unknown as HotTopicsRepository,
      blocklist,
    );

    const result = await uc.execute({ limit: 10 });
    expect(result.searched.items.map((i) => i.term)).toEqual(['makatn']);
    expect(result.proposed.items.map((i) => i.lemma)).toEqual(['nganga']);
    expect(result.viewed.items).toHaveLength(0);
    expect(result.check.items.map((i) => i.lemma)).toEqual(['nganga']);
    expect(blocklist.findActiveWordSet).toHaveBeenCalled();
  });
});
