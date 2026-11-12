import { describe, it, expect, vi } from 'vitest';
import { ListWordsUseCase } from '../../application/use-cases/list-words.use-case';
import {
  encodeListCursor,
  type WordRepository,
} from '../../domain/repositories/word.repository';

describe('ListWordsUseCase', () => {
  it('meneruskan q ter-trim + cursor ter-decode ke repo.listAtoZ, meta terisi', async () => {
    const listAtoZ = vi.fn().mockResolvedValue({
      items: [],
      nextCursor: encodeListCursor({ lemma: 'makatn', id: 'A'.repeat(26) }),
      hasMore: true,
    });
    const uc = new ListWordsUseCase({ listAtoZ } as unknown as WordRepository);

    const result = await uc.execute({
      q: '  mak  ',
      limit: 20,
      cursor: encodeListCursor({ lemma: 'kete', id: 'B'.repeat(26) }),
    });

    expect(listAtoZ).toHaveBeenCalledWith({
      q: 'mak',
      letter: undefined,
      limit: 20,
      wordType: undefined,
      isVerified: true,
      category: undefined,
      cursor: { lemma: 'kete', id: 'B'.repeat(26) },
    });
    expect(result.meta).toEqual({
      limit: 20,
      next_cursor: result.nextCursor,
      has_more: true,
    });
  });

  it('cursor invalid → 400 VALIDATION_ERROR (details cursor), repo TIDAK dipanggil', async () => {
    const listAtoZ = vi.fn();
    const uc = new ListWordsUseCase({ listAtoZ } as unknown as WordRepository);

    await expect(uc.execute({ q: '', limit: 20, cursor: 'bukan-base64-valid!!' })).rejects.toMatchObject({
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      details: [{ field: 'cursor' }],
    });
    expect(listAtoZ).not.toHaveBeenCalled();
  });

  it('tanpa cursor → listAtoZ dipanggil tanpa cursor', async () => {
    const listAtoZ = vi.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    const uc = new ListWordsUseCase({ listAtoZ } as unknown as WordRepository);
    await uc.execute({ q: '', limit: 10, wordType: 'peribahasa' });
    expect(listAtoZ).toHaveBeenCalledWith({
      q: '',
      letter: undefined,
      limit: 10,
      wordType: 'peribahasa',
      isVerified: true,
      category: undefined,
      cursor: undefined,
    });
  });

  it('verifikator → statuses pending_review+published, tanpa isVerified', async () => {
    const listAtoZ = vi.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    const uc = new ListWordsUseCase({ listAtoZ } as unknown as WordRepository);
    await uc.execute({ q: '', limit: 10, viewerRoles: ['reviewer'], isVerified: false });
    expect(listAtoZ).toHaveBeenCalledWith(
      expect.objectContaining({
        statuses: ['published', 'pending_review'],
      }),
    );
    expect(listAtoZ.mock.calls[0]![0]).not.toHaveProperty('isVerified');
  });

  it('kontributor non-verifikator → tetap force isVerified true', async () => {
    const listAtoZ = vi.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    const uc = new ListWordsUseCase({ listAtoZ } as unknown as WordRepository);
    await uc.execute({ q: '', limit: 10, viewerRoles: ['contributor'] });
    expect(listAtoZ).toHaveBeenCalledWith(expect.objectContaining({ isVerified: true }));
    expect(listAtoZ.mock.calls[0]![0]).not.toHaveProperty('statuses');
  });
});
