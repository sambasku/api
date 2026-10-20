import { describe, it, expect, vi } from 'vitest';

// Logger transitif import env Zod (butuh DATABASE_URL dll) - unit test
// tidak butuh logger asli, cukup mock supaya env tidak divalidasi.
vi.mock('@/shared/logging/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { SearchWordsUseCase } from '../../application/use-cases/search-words.use-case';
import type { WordRepository } from '../../domain/repositories/word.repository';
import type { WordSummary } from '../../domain/entities/word.entity';
import type { SearchMissRepository } from '@/modules/search-miss/domain/repositories/search-miss.repository';

// PRD relasi-lemma: perluasan pencarian ke anggota kelompok makna
// (match_type='related_group'). Hanya halaman pertama (tanpa cursor),
// best-effort, dedupe by id.
function summary(id: string, lemma: string): WordSummary {
  return {
    id,
    lemma,
    languageId: '01LANGLANGUAGESMB0000000',
    languageCode: 'smb',
    wordType: 'word',
    usageLabels: [],
    isVerified: true,
    matchedVariant: undefined,
    definitionPreview: null,
    translations: [],
    status: 'published',
  } as unknown as WordSummary;
}

function makeDeps(opts: {
  items?: WordSummary[];
  expansions?: WordSummary[];
  expansionsThrow?: boolean;
}) {
  const wordRepo = {
    search: vi.fn().mockResolvedValue({
      items: opts.items ?? [],
      nextCursor: null,
      hasMore: false,
    }),
    findRelatedGroupMembers: opts.expansionsThrow
      ? vi.fn().mockRejectedValue(new Error('db down'))
      : vi.fn().mockResolvedValue(opts.expansions ?? []),
  } as unknown as WordRepository;
  const searchMissRepo = {
    recordSearchDay: vi.fn().mockResolvedValue(undefined),
    record: vi.fn().mockResolvedValue(undefined),
  } as unknown as SearchMissRepository;
  return {
    wordRepo,
    searchMissRepo,
    useCase: new SearchWordsUseCase(wordRepo, searchMissRepo),
  };
}

const QUERY = { q: 'barakat', limit: 10 };

describe('SearchWordsUseCase - perluasan kelompok makna (PRD relasi-lemma)', () => {
  it('halaman pertama: hasil grup ditempel setelah hasil langsung, match_type=related_group, tanpa duplikat', async () => {
    const direct = [summary('01WORDDIRECT000000000000', 'barakat')];
    const expansion = [
      summary('01WORDDIRECT000000000000', 'barakat'), // sudah ada → dedupe
      summary('01WORDANGGOTA00000000000', 'barakah'), // anggota grup → tampil
    ];
    const { useCase, wordRepo } = makeDeps({ items: direct, expansions: expansion });

    const result = await useCase.execute(QUERY);

    expect(wordRepo.findRelatedGroupMembers).toHaveBeenCalledWith(['01WORDDIRECT000000000000']);
    expect(result.items.map((w) => [w.id, w.matchType])).toEqual([
      ['01WORDDIRECT000000000000', undefined],
      ['01WORDANGGOTA00000000000', 'related_group'],
    ]);
  });

  it('halaman lanjutan (cursor terisi) TIDAK diperluas', async () => {
    const { useCase, wordRepo } = makeDeps({
      items: [summary('01WORDDIRECT000000000000', 'barakat')],
    });
    await useCase.execute({ ...QUERY, cursor: 'eyJvIjoxfQ' });
    expect(wordRepo.findRelatedGroupMembers).not.toHaveBeenCalled();
  });

  it('search_in=translation TIDAK diperluas', async () => {
    const { useCase, wordRepo } = makeDeps({
      items: [summary('01WORDDIRECT000000000000', 'barakat')],
    });
    await useCase.execute({ ...QUERY, searchIn: 'translation', translationLanguageId: 'x' });
    expect(wordRepo.findRelatedGroupMembers).not.toHaveBeenCalled();
  });

  it('perluasan gagal → best-effort: hasil langsung tetap dikembalikan', async () => {
    const { useCase } = makeDeps({
      items: [summary('01WORDDIRECT000000000000', 'barakat')],
      expansionsThrow: true,
    });
    const result = await useCase.execute(QUERY);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe('01WORDDIRECT000000000000');
  });

  it('hasil langsung kosong → tidak memanggil perluasan', async () => {
    const { useCase, wordRepo } = makeDeps({ items: [] });
    await useCase.execute(QUERY);
    expect(wordRepo.findRelatedGroupMembers).not.toHaveBeenCalled();
  });
});
