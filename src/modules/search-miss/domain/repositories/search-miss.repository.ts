import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type { SearchMiss, SearchMissDirection } from '../entities/search-miss.entity';

export interface SearchMissListFilter {
  /** public = hanya yang belum terjawab + visible; admin = semua + cursor */
  scope: 'public' | 'admin';
  direction?: SearchMissDirection;
  /** admin only - filter status terjawab (derived) */
  fulfilled?: boolean;
  /** admin only - filter gate tayang (14-api) */
  visible?: boolean;
  limit: number;
  cursor?: string;
}

export interface SearchMissUpdatePatch {
  term?: string;
  isVisible?: boolean;
}

// Interface lintas modul (pola Section 4): di-inject ke SearchWordsUseCase
// (modul word) untuk mencatat pencarian kosong, dan dipakai modul sendiri
// untuk endpoint beranda + panel admin.
export interface SearchMissRepository {
  /**
   * Upsert istilah: hit_count + 1 kalau sudah pernah dicari. Best-effort.
   *
   * `searcherId` (opsional) = user yang sedang login. Dicatat di tabel
   * `search_miss_searchers` supaya feed `exclude_self` bisa menyembunyikan
   * miss yang dipicu user tersebut. Tanpa id (tamu) tidak ada yang dicatat:
   * miss tetap muncul untuk semua, seperti sebelumnya.
   */
  record(input: {
    term: string;
    direction: SearchMissDirection;
    searcherId?: string;
  }): Promise<void>;
  /** Load miss aktif (deleted_at IS NULL). Null kalau tidak ada / dismissed. */
  findById(id: string): Promise<SearchMiss | null>;
  list(filter: SearchMissListFilter): Promise<CursorPage<SearchMiss>>;
  /** Soft-delete (dismiss dari panel admin). Return false kalau tidak ada. */
  dismiss(id: string, actorId: string): Promise<boolean>;
  /**
   * Soft-delete massal (satu query IN). Return id yang benar-benar di-update
   * (sudah dismissed / tidak ada tidak ikut).
   */
  dismissMany(ids: string[], actorId: string): Promise<string[]>;
  /**
   * Partial update term / is_visible (14-api). Null kalau tidak ada.
   * Unique (term,direction) collision → throw ConflictError.
   */
  update(id: string, patch: SearchMissUpdatePatch): Promise<SearchMiss | null>;
}
