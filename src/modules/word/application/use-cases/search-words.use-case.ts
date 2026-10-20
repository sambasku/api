import { logger } from '@/shared/logging/logger';
import type { SearchMissRepository } from '@/modules/search-miss/domain/repositories/search-miss.repository';
import type { WordSummary } from '../../domain/entities/word.entity';
import type { CursorPage, WordRepository } from '../../domain/repositories/word.repository';

export interface SearchWordsQuery {
  q: string;
  limit: number;
  cursor?: string;
  searchIn?: 'lemma' | 'translation';
  translationLanguageId?: string;
  wordType?: string;
  isVerified?: boolean;
  /**
   * User yang sedang login (soft auth). Kalau ada, pencarian kosong ikut
   * mencatat siapa pemicunya supaya feed `exclude_self` bisa menyembunyikan
   * miss itu dari berandanya sendiri. Tanpa id (tamu) tidak ada yang dicatat.
   */
  viewerId?: string;
}

export interface SearchWordsResult extends CursorPage<WordSummary> {
  meta: { limit: number; next_cursor: string | null; has_more: boolean };
}

// Searchable dropdown sinonim/antonim di form admin - HANYA kata
// published + belum soft-deleted (draft tidak bocor ke publik).
// Pagination cursor-based (base-stack.md Section 13).
//
// Pencarian KOSONG dicatat sebagai search miss (03-api-kontribusi-verifikasi
// .md): muncul di panel admin + beranda user lain sebagai peluang kontribusi.
export class SearchWordsUseCase {
  constructor(
    private readonly wordRepo: WordRepository,
    private readonly searchMissRepo: SearchMissRepository,
  ) {}

  async execute(query: SearchWordsQuery): Promise<SearchWordsResult> {
    // `viewerId` milik atribusi search-miss, bukan parameter query kata -
    // dilepas sebelum diteruskan ke repo (query di sini juga jadi argumen REST).
    const { viewerId, ...wordQuery } = query;

    // Publik / dropdown: selalu published saja
    const { items, nextCursor, hasMore } = await this.wordRepo.search({
      ...wordQuery,
      published: true,
    });

    // Counter pencarian harian (hit + miss) untuk chart dashboard.
    // Best-effort: kegagalan tidak boleh membatalkan response.
    if (query.q.trim().length > 0) {
      try {
        await this.searchMissRepo.recordSearchDay();
      } catch (err) {
        logger.warn({ err, q: query.q }, 'gagal mencatat counter pencarian harian');
      }
    }
    // PRD relasi-lemma: perluasan kelompok makna. Halaman pertama (tanpa
    // cursor) hasil langsung ditempeli anggota grup published lain (dedupe
    // by id, ranking hasil langsung tetap di atas, cap limit + has_more).
    // Halaman lanjutan tidak diperluas supaya pagination offset FTS stabil.
    if (query.searchIn !== 'translation' && query.cursor === undefined && items.length > 0) {
      try {
        const expansions = await this.wordRepo.findRelatedGroupMembers(items.map((i) => i.id));
        if (expansions.length > 0) {
          const seen = new Set(items.map((i) => i.id));
          for (const exp of expansions) {
            if (seen.has(exp.id)) continue;
            seen.add(exp.id);
            items.push({ ...exp, matchType: 'related_group' });
          }
        }
      } catch (err) {
        // Perluasan best-effort: kegagalan tidak boleh membatalkan pencarian.
        logger.warn({ err, q: query.q }, 'gagal memperluas pencarian kelompok makna');
      }
    }

    if (items.length === 0 && query.q.trim().length >= 2) {
      // Best-effort: kegagalan pencatatan tidak boleh membatalkan response
      try {
        await this.searchMissRepo.record({
          term: query.q,
          direction: query.searchIn === 'translation' ? 'translation' : 'lemma',
          searcherId: viewerId,
        });
      } catch (err) {
        logger.warn({ err, q: query.q }, 'gagal mencatat search miss');
      }
    }

    return {
      items,
      nextCursor,
      hasMore,
      meta: { limit: query.limit, next_cursor: nextCursor, has_more: hasMore },
    };
  }
}
