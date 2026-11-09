import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';
import { jinye } from './jinye.schema';

export const JINYE_TRANSLATION_STATUSES = [
  'pending',
  'accepted',
  'rejected',
] as const;
export type JinyeTranslationStatus = (typeof JINYE_TRANSLATION_STATUSES)[number];

/**
 * Usulan terjemahan Indonesia untuk body Jinye.
 * Max satu `accepted` + satu `pending` per translator ditegakkan di use case.
 */
export const jinyeTranslations = sqliteTable(
  'jinye_translations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    jinyeId: text('jinye_id')
      .notNull()
      .references(() => jinye.id),
    /** Teks Indonesia. */
    bodyId: text('body_id').notNull(),
    status: text('status', { enum: JINYE_TRANSLATION_STATUSES })
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
    index('jinye_translations_jinye_idx').on(t.jinyeId, t.status),
    index('jinye_translations_translator_idx').on(t.translatorId),
  ],
);
