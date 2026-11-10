import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';

export const TRANSLATION_STATUSES = [
  'pending',
  'accepted',
  'rejected',
] as const;
export type TranslationStatus = (typeof TRANSLATION_STATUSES)[number];

/** Reff yang didukung create/list. Tambah di sini saat sumber baru. */
export const TRANSLATION_REFFS = ['jinye'] as const;
export type TranslationReff = (typeof TRANSLATION_REFFS)[number];

/**
 * Usulan terjemahan generik (multi-sumber).
 * Jinye: reff=`jinye`, reff_id=id Jinye.
 * Max satu `accepted` + satu `pending` per translator ditegakkan di use case.
 */
export const translations = sqliteTable(
  'translations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    reff: text('reff').notNull(),
    reffId: text('reff_id').notNull(),
    /** Teks terjemahan. */
    body: text('body').notNull(),
    status: text('status', { enum: TRANSLATION_STATUSES })
      .notNull()
      .default('pending'),
    translatorId: text('translator_id')
      .notNull()
      .references(() => users.id),
    reviewedBy: text('reviewed_by').references(() => users.id),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('translations_reff_idx').on(t.reff, t.reffId, t.status),
    index('translations_translator_idx').on(t.translatorId),
  ],
);
