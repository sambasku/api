import { describe, expect, it, vi } from 'vitest';
import {
  CONTENT_LINK_CAP,
  canonicalizePair,
} from '../../domain/content-link';
import {
  ListRelatedContentUseCase,
  ReplaceContentLinksUseCase,
} from '../../application/content-link.use-cases';
import type { ContentLinkRepository } from '../../domain/content-link.repository';
import type { ResolveContentLinks } from '../../application/resolve-content-links';

describe('canonicalizePair', () => {
  it('urutkan lexicographic undirected', () => {
    const pair = canonicalizePair(
      { kind: 'word', id: '02' },
      { kind: 'article', id: '01' },
    );
    expect(pair).toEqual({
      a: { kind: 'article', id: '01' },
      b: { kind: 'word', id: '02' },
    });
  });

  it('tolak self-link', () => {
    expect(
      canonicalizePair(
        { kind: 'article', id: '01' },
        { kind: 'article', id: '01' },
      ),
    ).toBeNull();
  });
});

describe('ReplaceContentLinksUseCase', () => {
  it('replace-set menulis pasangan kanonik', async () => {
    const replaceForAnchor = vi.fn().mockResolvedValue(undefined);
    const repo = { replaceForAnchor, listForEndpoint: vi.fn() } as unknown as ContentLinkRepository;
    const resolve = vi.fn().mockResolvedValue([
      {
        kind: 'word',
        id: '01WORD',
        slug: null,
        title: 'makan',
        coverUrl: null,
      },
    ]);
    const resolver = { resolve } as unknown as ResolveContentLinks;
    const uc = new ReplaceContentLinksUseCase(repo, resolver);

    const out = await uc.execute({
      anchor: { kind: 'article', id: '01ART' },
      related: [{ kind: 'word', id: '01WORD' }],
      createdBy: '01USER',
    });

    expect(out).toHaveLength(1);
    expect(replaceForAnchor).toHaveBeenCalledWith({
      anchor: { kind: 'article', id: '01ART' },
      createdBy: '01USER',
      pairs: [
        {
          a: { kind: 'article', id: '01ART' },
          b: { kind: 'word', id: '01WORD' },
        },
      ],
    });
  });

  it('cap > 12 ditolak', async () => {
    const repo = {
      replaceForAnchor: vi.fn(),
      listForEndpoint: vi.fn(),
    } as unknown as ContentLinkRepository;
    const resolver = { resolve: vi.fn() } as unknown as ResolveContentLinks;
    const uc = new ReplaceContentLinksUseCase(repo, resolver);
    const related = Array.from({ length: CONTENT_LINK_CAP + 1 }, (_, i) => ({
      kind: 'word' as const,
      id: `id${i}`,
    }));
    await expect(
      uc.execute({
        anchor: { kind: 'article', id: '01ART' },
        related,
        createdBy: null,
      }),
    ).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
  });

  it('self-link ditolak setelah resolve', async () => {
    const repo = {
      replaceForAnchor: vi.fn(),
      listForEndpoint: vi.fn(),
    } as unknown as ContentLinkRepository;
    const resolver = {
      resolve: vi.fn().mockResolvedValue([
        {
          kind: 'article',
          id: '01ART',
          slug: 'x',
          title: 'X',
          coverUrl: null,
        },
      ]),
    } as unknown as ResolveContentLinks;
    const uc = new ReplaceContentLinksUseCase(repo, resolver);
    await expect(
      uc.execute({
        anchor: { kind: 'article', id: '01ART' },
        related: [{ kind: 'article', id: '01ART' }],
        createdBy: null,
      }),
    ).rejects.toMatchObject({ errorCode: 'RELATED_SELF' });
  });
});

describe('ListRelatedContentUseCase', () => {
  it('resolve sisi lawan dari edge', async () => {
    const repo = {
      listForEndpoint: vi.fn().mockResolvedValue([
        {
          id: 'L1',
          aKind: 'article',
          aId: '01ART',
          bKind: 'word',
          bId: '01WORD',
          createdBy: null,
          createdAt: new Date(),
          updatedAt: null,
        },
      ]),
      replaceForAnchor: vi.fn(),
    } as unknown as ContentLinkRepository;
    const resolver = {
      resolveEndpoints: vi.fn().mockResolvedValue([
        {
          kind: 'word',
          id: '01WORD',
          slug: null,
          title: 'makan',
          coverUrl: null,
        },
      ]),
    } as unknown as ResolveContentLinks;
    const uc = new ListRelatedContentUseCase(repo, resolver);
    const out = await uc.execute('article', '01ART');
    expect(out).toEqual([
      {
        kind: 'word',
        id: '01WORD',
        slug: null,
        title: 'makan',
        coverUrl: null,
      },
    ]);
  });
});
