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
  /**
   * false = explore/typeahead (jangan rekam miss/counter).
   * true / omit = commit search (boleh rekam miss saat 0 hasil).
   */
  recordMiss?: boolean;
}

export interface SearchWordsResult extends CursorPage<WordSummary> {
  meta: {
    limit: number;
    next_cursor: string | null;
    has_more: boolean;
    /** G3b: id miss yang baru/di-upsert saat 0 hasil (untuk CTA koreksi). */
    search_miss_id?: string | null;
  };
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
    // `viewerId` / `viewerRoles` / `recordMiss` milik soft-auth / intent -
    // dilepas sebelum diteruskan ke repo.
    const {
      viewerId,
      viewerRoles,
      isVerified: _ignored,
      recordMiss: recordMissRaw,
      ...wordQuery
    } = query;
    const recordMiss = recordMissRaw !== false;
    const gate = publicReadGate(viewerRoles);

    const { items, nextCursor, hasMore } = await this.wordRepo.search({
      ...wordQuery,
      ...(gate.statuses
        ? { statuses: gate.statuses }
        : { published: true, isVerified: true }),
    });

    // Counter + miss hanya saat commit (bukan ketikan typeahead).
    if (recordMiss && query.q.trim().length > 0) {
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

    let searchMissId: string | null = null;
    if (recordMiss && items.length === 0 && query.q.trim().length >= 2) {
      // Best-effort: kegagalan pencatatan tidak boleh membatalkan response.
      // preferVisible dipisah: gagal resolve (settings/blocklist) jangan
      // mencegah INSERT miss - gejala staging G3 (search 0 hasil tanpa baris).
      let preferVisible = false;
      try {
        preferVisible = await resolveSearchMissPreferVisible({
          term: query.q,
          blocklist: this.blocklistRepo,
        });
      } catch (err) {
        logger.warn({ err, q: query.q }, 'gagal resolve search miss auto-visible');
      }
      try {
        const recorded = await this.searchMissRepo.record({
          term: query.q,
          direction: query.searchIn === 'translation' ? 'translation' : 'lemma',
          searcherId: viewerId,
          preferVisible,
        });
        searchMissId = recorded?.id ?? null;
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
      meta: {
        limit: query.limit,
        next_cursor: nextCursor,
        has_more: hasMore,
        ...(searchMissId ? { search_miss_id: searchMissId } : {}),
      },
    };
  }
}
