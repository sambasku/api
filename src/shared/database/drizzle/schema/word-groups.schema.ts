import { sqliteTable, text, integer, index, unique } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { words } from './words.schema';
import { users } from './users.schema';

/**
 * PRD relasi-lemma - kelompok lema bermakna sama/berdekatan (mis. ngape,
 * jape, jope = "kenapa"). Tiga lema tetap entri terpisah; kelompok hanya
 * mengelompokkan untuk perluasan pencarian + tampilan detail.
 * Moderasi di tingkat kelompok DAN anggota (dua baris status terpisah,
 * tidak ada sumber status yang bertabrakan).
 */
export const wordGroups = sqliteTable('word_groups', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  // Label kelompok tampilan (mis. "kenapa") - bukan identitas linguistik.
  name: text('name').notNull(),
  description: text('description'),
  // 'pending_review' | 'published' | 'rejected'. Default aman: insert lupa
  // set status = tidak ikut melebar ke pencarian publik.
  status: text('status').notNull().default('pending_review'),
  isVerified: integer('is_verified', { mode: 'boolean' }).notNull().default(false),
  createdBy: text('created_by').references(() => users.id),
  updatedBy: text('updated_by').references(() => users.id),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  deletedBy: text('deleted_by').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const wordGroupMembers = sqliteTable(
  'word_group_members',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    groupId: text('group_id')
      .notNull()
      .references(() => wordGroups.id),
    wordId: text('word_id')
      .notNull()
      .references(() => words.id),
    // Nuansa/konteks keanggotaan (mis. "lisan, agak jenaka") - opsional.
    notes: text('notes'),
    status: text('status').notNull().default('pending_review'),
    createdBy: text('created_by').references(() => users.id),
    updatedBy: text('updated_by').references(() => users.id),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
    deletedBy: text('deleted_by').references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    unique('word_group_members_unique').on(t.groupId, t.wordId),
    // Perluasan pencarian: kelompok milik sebuah kata.
    index('word_group_members_word_idx').on(t.wordId),
    index('word_group_members_group_idx').on(t.groupId),
  ],
);
