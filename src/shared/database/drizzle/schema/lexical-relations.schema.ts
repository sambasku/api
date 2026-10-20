import { sqliteTable, text, integer, index, unique } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { words } from './words.schema';
import { users } from './users.schema';

export const lexicalRelations = sqliteTable(
  'lexical_relations',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    sourceWordId: text('source_word_id')
      .notNull()
      .references(() => words.id),
    targetWordId: text('target_word_id')
      .notNull()
      .references(() => words.id),
  // synonym | antonym | has_component | derived_from | variant_of | nonstandard_of
  relationType: text('relation_type').notNull(),
  notes: text('notes'),
  // PRD relasi-lemma: moderasi per baris relasi. Baris lama (sebelum
  // migration 0082) otomatis 'published' via column default.
  // 'pending_review' | 'published' | 'rejected' - pola sama child entity.
  status: text('status').notNull().default('published'),
  isVerified: integer('is_verified', { mode: 'boolean' }).notNull().default(false),
  createdBy: text('created_by').references(() => users.id),
  updatedBy: text('updated_by').references(() => users.id),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  deletedBy: text('deleted_by').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
},
  (t) => [
    unique('lexical_relations_unique').on(t.sourceWordId, t.targetWordId, t.relationType),
    // query invers "muncul dalam" (mis. komponen → peribahasa pemakainya)
    index('lexical_relations_target_idx').on(t.targetWordId),
  ],
);
