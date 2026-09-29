import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';
import { searchMisses } from './search-misses.schema';

export const contributions = sqliteTable(
  'contributions',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    // 'word' | 'meaning' | dst
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    // 'create' | 'update' | 'delete' | 'publish' | dst
    action: text('action').notNull(),
    // Status antrean review (Section 22 - approval gate):
    // pending | approved | rejected | corrected - turunan dari status
    // entity saat insert ('pending_review' → 'pending', selain itu
    // 'approved'); baris lama di-backfill 'approved' lewat migration
    status: text('status').notNull().default('pending'),
    description: text('description'),
    /**
     * Nama tampilan opsional dari tamu (tanpa akun) - atribusi teks bebas.
     * user_id tetap Anonim; antrean memakai ini sebagai contributor_display_name.
     */
    guestDisplayName: text('guest_display_name'),
    // Provenance jalur search-miss (12-api) - nullable: kontribusi biasa OK
    searchMissId: text('search_miss_id').references(() => searchMisses.id),
    /**
     * Soft-claim setelah reopen: pending + reopened_by dipegang verifikator
     * yang membuka ulang. Antrean global Menunggu mengecualikan baris ini
     * kecuali viewer = reopened_by atau admin/root. Di-clear saat decide.
     */
    reopenedBy: text('reopened_by').references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
    deletedBy: text('deleted_by').references(() => users.id),
  },
  (t) => [
    index('contributions_user_created_idx').on(t.userId, t.createdAt),
    index('contributions_entity_idx').on(t.entityType, t.entityId),
    index('contributions_status_idx').on(t.status),
    index('contributions_search_miss_idx').on(t.searchMissId),
    index('contributions_status_reopened_by_idx').on(t.status, t.reopenedBy),
  ],
);
