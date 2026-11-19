import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';
import { usahas } from './usahas.schema';

/** Tingkat dukungan - urutan naik: perak < emas < intan < mustika. */
export const SPONSORSHIP_TIERS = ['perak', 'emas', 'intan', 'mustika'] as const;
export type SponsorshipTier = (typeof SPONSORSHIP_TIERS)[number];

/** Tier yang boleh tampil di splash (butuh usaha_id). */
export const SPLASH_SPONSORSHIP_TIERS = ['emas', 'intan', 'mustika'] as const;

/**
 * Sponsor & Mitra (pengganti CDN sponsors.json).
 * - Org tanpa akun: CRUD admin, `user_id` / `usaha_id` null.
 * - Checkbox di user: upsert baris dengan `user_id`; uncheck = soft-delete.
 * - Splash Emas+: `usaha_id` set + tier emas/intan/mustika + jendela aktif.
 */
export const sponsorships = sqliteTable(
  'sponsorships',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    /** Null = sponsor org/orang tanpa akun SambasKu. */
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    /** Null = belum / tidak ditautkan ke listing usaha. */
    usahaId: text('usaha_id').references(() => usahas.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    description: text('description'),
    logoUrl: text('logo_url'),
    url: text('url'),
    /** Username SambasKu opsional - tap profil in-app. */
    username: text('username'),
    /** perak | emas | intan | mustika */
    tier: text('tier').$type<SponsorshipTier>().notNull().default('perak'),
    /** ISO date YYYY-MM-DD - sort terlama dulu. */
    since: text('since').notNull(),
    /** ISO date YYYY-MM-DD - null = tanpa batas. */
    endsOn: text('ends_on'),
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
    index('sponsorships_usaha_id_idx').on(t.usahaId),
    index('sponsorships_tier_idx').on(t.tier),
    // Satu sponsorship aktif per user (checkbox).
    uniqueIndex('sponsorships_user_id_active_uidx')
      .on(t.userId)
      .where(sql`user_id is not null and deleted_at is null`),
    // Satu sponsorship aktif per usaha (lencana).
    uniqueIndex('sponsorships_usaha_id_active_uidx')
      .on(t.usahaId)
      .where(sql`usaha_id is not null and deleted_at is null`),
  ],
);
