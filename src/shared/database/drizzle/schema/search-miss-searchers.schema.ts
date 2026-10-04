import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { searchMisses } from './search-misses.schema';
import { users } from './users.schema';

// Siapa saja yang sudah mencari istilah yang bermiss (37-api-activity-feed.md
// `exclude_self`).
//
// Kenapa tabel terpisah, bukan kolom `user_id` di `search_misses`: satu baris
// miss dipecah per (term, direction) - satu istilah bisa dicari banyak user.
// Kolom user tunggal hanya akan menyimpan searcher terakhir dan ikut hilang
// setiap kali orang lain mencari istilah yang sama.
//
// Yang disimpan bukan "miss ini karya dia" tapi "dia ikut mencari yang ini" -
// jadi feed `exclude_self` bisa menyembunyikan miss yang pemicunya user yang
// sedang login. Baris hilang kalau user/miss dihapus (cascade lewat FK di
// migrate); tidak ada soft-delete karena yang dilacak cuma "pernah mencari".
export const searchMissSearchers = sqliteTable(
  'search_miss_searchers',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    searchMissId: text('search_miss_id')
      .notNull()
      .references(() => searchMisses.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    // Satu user satu baris per miss - ulangi pencarian hanya menyentuh
    // `created_at`, tidak menambah baris.
    uniqueIndex('search_miss_searchers_miss_user_unique').on(t.searchMissId, t.userId),
    // Arah feed: "miss mana yang pernah dicari user ini" - excludeUserId di SQL.
    index('search_miss_searchers_user_miss_idx').on(t.userId, t.searchMissId),
  ],
);
