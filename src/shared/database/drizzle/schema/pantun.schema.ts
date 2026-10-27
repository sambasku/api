import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';
import { categories } from './categories.schema';

export const PANTUN_RHYME_SCHEMES = ['ABAB', 'AAAA'] as const;
export type PantunRhymeScheme = (typeof PANTUN_RHYME_SCHEMES)[number];

export const PANTUN_STATUSES = [
  'published',
  'taken_down',
  'deleted_by_author',
] as const;
export type PantunStatus = (typeof PANTUN_STATUSES)[number];

export const PANTUN_REPLY_STATUSES = [
  'published',
  'taken_down',
  'deleted_by_author',
] as const;
export type PantunReplyStatus = (typeof PANTUN_REPLY_STATUSES)[number];

/**
 * Pantun 4 baris (kategori Hiburan, PRD Pantun). Post-moderation:
 * langsung published, admin bisa takedown.
 */
export const pantuns = sqliteTable(
  'pantuns',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    /** Referensi tema (row categories); null = tanpa tema. */
    categoryId: text('category_id').references(() => categories.id),
    /** Kode bahasa (mis. id, sbs); default 'id'. */
    language: text('language').notNull().default('id'),
    rhymeScheme: text('rhyme_scheme', {
      enum: PANTUN_RHYME_SCHEMES,
    }).notNull(),
    /** Empat baris pantun (JSON array string, urut pembayang-isi). */
    lines: text('lines', { mode: 'json' }).$type<string[]>().notNull(),
    status: text('status', { enum: PANTUN_STATUSES })
      .notNull()
      .default('published'),
    takenDownBy: text('taken_down_by').references(() => users.id),
    takenDownAt: integer('taken_down_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('pantuns_status_id_idx').on(t.status, t.id),
    index('pantuns_category_status_idx').on(t.categoryId, t.status, t.id),
  ],
);

/**
 * Balasan pantun (satu level: balasan menunjuk pantun pembuka via
 * parent_id). Status sama dengan pola discussion_replies.
 */
export const pantunReplies = sqliteTable(
  'pantun_replies',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    /** Pantun pembuka yang dibalas. Wajib. */
    parentId: text('parent_id')
      .notNull()
      .references(() => pantuns.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    categoryId: text('category_id').references(() => categories.id),
    language: text('language').notNull().default('id'),
    rhymeScheme: text('rhyme_scheme', {
      enum: PANTUN_RHYME_SCHEMES,
    }).notNull(),
    lines: text('lines', { mode: 'json' }).$type<string[]>().notNull(),
    status: text('status', { enum: PANTUN_REPLY_STATUSES })
      .notNull()
      .default('published'),
    takenDownBy: text('taken_down_by').references(() => users.id),
    takenDownAt: integer('taken_down_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('pantun_replies_parent_created_idx').on(t.parentId, t.createdAt, t.id),
    index('pantun_replies_status_idx').on(t.status, t.id),
  ],
);
