import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import { WordSuggestionController } from '../../presentation/v1/word-suggestions.controller';
import type { suggestionListResponseSchema } from '../../presentation/v1/validators/suggestion.validator';

type ListBody = z.infer<typeof suggestionListResponseSchema>;

const WORD_ID = '01M2WKYMEC2NSMFAJX12P4V8HG';
const USER_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

const summaryChanges = {
  lemma: null,
  notes: null,
  wordType: null,
  meaningsCount: 1,
  categoriesAdded: 0,
  categoriesRemoved: 0,
  relationsCount: 0,
  variantsCount: 0,
  imagesCount: 0,
  groupsCount: 2,
};

const listSuggestions = vi.fn(async () => ({
  items: [
    {
      id: WORD_ID,
      wordId: WORD_ID,
      wordLemma: 'lading',
      contributorId: USER_ID,
      contributorUsername: 'kontributor',
      contributorDisplayName: 'Kontributor',
      reason: 'Salah ketik',
      reasonCode: 'typo',
      status: 'pending',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      summaryChanges,
    },
  ],
  nextCursor: null,
  hasMore: false,
}));

const repository = { listSuggestions } as unknown as NonNullable<
  ConstructorParameters<typeof WordSuggestionController>[0]
>['repository'];

function buildApp() {
  const controller = new WordSuggestionController({ repository });
  return new Hono().get('/', (c) => controller.listSuggestions(c, 20));
}

describe('GET /admin/word-suggestions response', () => {
  it('sukses 200 - semua field summary_changes terkirim termasuk groups_count', async () => {
    const res = await buildApp().request('/');

    expect(res.status).toBe(200);
    const body = (await res.json()) as ListBody;
    expect(body.success).toBe(true);
    expect(body.data[0].summary_changes).toEqual({
      lemma: null,
      notes: null,
      word_type: null,
      meanings_count: 1,
      categories_added: 0,
      categories_removed: 0,
      relations_count: 0,
      variants_count: 0,
      images_count: 0,
      groups_count: 2,
    });
  });

  it('list kosong tetap 200', async () => {
    listSuggestions.mockResolvedValueOnce({
      items: [],
      nextCursor: null,
      hasMore: false,
    } as unknown as Awaited<ReturnType<typeof listSuggestions>>);

    const res = await buildApp().request('/');

    expect(res.status).toBe(200);
    expect(((await res.json()) as ListBody).data).toEqual([]);
  });
});
