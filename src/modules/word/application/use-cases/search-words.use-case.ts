import { logger } from '@/shared/logging/logger';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import { resolveSearchMissPreferVisible } from '@/modules/search-miss/application/resolve-auto-visible';
import type { SearchMissRepository } from '@/modules/search-miss/domain/repositories/search-miss.repository';
import type { WordSummary } from '../../domain/entities/word.entity';
import type { CursorPage, WordRepository } from '../../domain/repositories/word.repository';
import { publicReadGate } from '../utils/resolve-publication';

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
  /** Role dari soft auth - gate verifikator (pending_review + published). */
  viewerRoles?: string[];
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
    private readonly blocklistRepo?: Pick<CommentBlocklistRepository, 'findActiveWordSet'>,
    private readonly activityEvents?: {
      safe: (cmd: {
        kind: 'search_miss';
        targetId: string;
        dedupeKey: string;
        hidden?: boolean;
      }) => Promise<void>;
    },
  ) {}

  async execute(query: SearchWordsQuery): Promise<SearchWordsResult> {
    // `viewerId` / `viewerRoles` milik soft-auth - dilepas sebelum diteruskan
    // ke repo (query di sini juga jadi argumen REST).
    const { viewerId, viewerRoles, isVerified: _ignored, ...wordQuery } = query;
    const gate = publicReadGate(viewerRoles);

    const { items, nextCursor, hasMore } = await this.wordRepo.search({
      ...wordQuery,
      ...(gate.statuses
        ? { statuses: gate.statuses }
        : { published: true, isVerified: true }),
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
        const preferVisible = await resolveSearchMissPreferVisible({
          term: query.q,
          blocklist: this.blocklistRepo,
        });
        const recorded = await this.searchMissRepo.record({
          term: query.q,
          direction: query.searchIn === 'translation' ? 'translation' : 'lemma',
          searcherId: viewerId,
          preferVisible,
        });
        // G3: event feed saat pertama kali auto-tayang (dedupe sama PATCH admin).
        if (recorded?.becameVisible) {
          await this.activityEvents?.safe({
            kind: 'search_miss',
            targetId: recorded.id,
            dedupeKey: `search_miss:${recorded.id}`,
            hidden: false,
          });
        }
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
