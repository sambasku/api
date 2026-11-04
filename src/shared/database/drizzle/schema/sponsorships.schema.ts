import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';

/**
 * Sponsor & Mitra (pengganti CDN sponsors.json).
 * - Org tanpa akun: CRUD admin, `user_id` null.
 * - Checkbox di user: upsert baris dengan `user_id`; uncheck = soft-delete.
 */
export const sponsorships = sqliteTable(
  'sponsorships',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    /** Null = sponsor org/orang tanpa akun SambasKu. */
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    description: text('description'),
    logoUrl: text('logo_url'),
    url: text('url'),
    /** Username SambasKu opsional - tap profil in-app. */
    username: text('username'),
    /** ISO date YYYY-MM-DD - sort terlama dulu. */
    since: text('since').notNull(),
    note: text('note').notNull().default(''),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('sponsorships_since_idx').on(t.since),
    index('sponsorships_deleted_at_idx').on(t.deletedAt),
    // Satu sponsorship aktif per user (checkbox).
    uniqueIndex('sponsorships_user_id_active_uidx')
      .on(t.userId)
      .where(sql`user_id is not null and deleted_at is null`),
  ],
);
