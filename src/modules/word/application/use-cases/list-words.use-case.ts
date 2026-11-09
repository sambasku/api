import { ValidationError } from '@/shared/errors/app-error';
import type { WordSummary } from '../../domain/entities/word.entity';
import {
  decodeListCursor,
  type CursorPage,
  type WordRepository,
} from '../../domain/repositories/word.repository';
import { publicReadGate } from '../utils/resolve-publication';

export interface ListWordsQuery {
  q: string;
  /** Satu huruf A-Z untuk jump prefix (panel beranda). */
  letter?: string;
  limit: number;
  cursor?: string;
  wordType?: string;
  isVerified?: boolean;
  /** Filter kategori (api#50): id ULID atau nama case-insensitive. */
  category?: string;
  /** Role dari soft auth - gate verifikator (pending_review + published). */
  viewerRoles?: string[];
}

export interface ListWordsResult extends CursorPage<WordSummary> {
  meta: { limit: number; next_cursor: string | null; has_more: boolean };
}

/**
 * Daftar semua kata A-Z publik (18-api-list-words.md). TIPIS seperti
 * ListAdminWordsUseCase - TIDAK merekam search-miss: browsing daftar
 * bukan pencarian gagal (miss hanya di /words/search, kontrak 12).
 */
export class ListWordsUseCase {
  constructor(private readonly wordRepo: WordRepository) {}

  async execute(query: ListWordsQuery): Promise<ListWordsResult> {
    let cursor: { lemma: string; id: string } | undefined;
    if (query.cursor) {
      try {
        cursor = decodeListCursor(query.cursor);
      } catch {
        throw new ValidationError([{ field: 'cursor', message: 'Format cursor tidak valid' }]);
      }
    }

    const gate = publicReadGate(query.viewerRoles);
    // Publik A-Z: published + verified. Verifikator: statuses tanpa paksa verified.
    // Query is_verified dari klien diabaikan di kedua mode.
    const { items, nextCursor, hasMore } = await this.wordRepo.listAtoZ({
      q: query.q.trim(),
      letter: query.letter,
      limit: query.limit,
      wordType: query.wordType,
      category: query.category?.trim() || undefined,
      cursor,
      ...(gate.statuses
        ? { statuses: gate.statuses }
        : { isVerified: true }),
    });

    return {
      items,
      nextCursor,
      hasMore,
      meta: { limit: query.limit, next_cursor: nextCursor, has_more: hasMore },
    };
  }
}
