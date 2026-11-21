import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { karyas } from './karyas.schema';

export const KARYA_EXCERPT_KINDS = [
  'lyrics',
  'dialogue',
  'book_quote',
  'other',
] as const;
export type KaryaExcerptKind = (typeof KARYA_EXCERPT_KINDS)[number];

export const KARYA_EXCERPT_RIGHTS_STATUSES = [
  'public_domain',
  'licensed',
  'permission',
  'fair_quote',
  'unknown',
] as const;
export type KaryaExcerptRightsStatus =
  (typeof KARYA_EXCERPT_RIGHTS_STATUSES)[number];

export const KARYA_EXCERPT_PUBLISH_STATUSES = [
  'draft',
  'published',
  'archived',
  'restricted',
] as const;
export type KaryaExcerptPublishStatus =
  (typeof KARYA_EXCERPT_PUBLISH_STATUSES)[number];

/** A2: lirik/teks penuh hanya status ini. */
export const KARYA_EXCERPT_FULL_TEXT_RIGHTS = [
  'public_domain',
  'licensed',
  'permission',
] as const;

/** Cuplikan default (KARYA.md): ≤4 baris atau ≤500 karakter. */
export const KARYA_EXCERPT_FAIR_QUOTE_MAX_CHARS = 500;
export const KARYA_EXCERPT_FAIR_QUOTE_MAX_LINES = 4;

/**
 * Cuplikan lirik/dialog/dll. Masuk lewat usulan (pre-moderation).
 * Lemma links (G5) menempel ke baris published di sini.
 */
export const karyaExcerpts = sqliteTable(
  'karya_excerpts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    karyaId: text('karya_id')
      .notNull()
      .references(() => karyas.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: KARYA_EXCERPT_KINDS }).notNull(),
    text: text('text').notNull(),
    language: text('language'),
    startLabel: text('start_label'),
    endLabel: text('end_label'),
    rightsStatus: text('rights_status', {
      enum: KARYA_EXCERPT_RIGHTS_STATUSES,
    }).notNull(),
    /** Wajib diisi saat A2 (izin/lisensi dari siapa). */
    rightsNote: text('rights_note'),
    sourceUrl: text('source_url'),
    publishStatus: text('publish_status', {
      enum: KARYA_EXCERPT_PUBLISH_STATUSES,
    })
      .notNull()
      .default('draft'),
    authorId: text('author_id'),
    publishedAt: integer('published_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('karya_excerpts_karya_status_idx').on(t.karyaId, t.publishStatus),
    index('karya_excerpts_kind_status_idx').on(t.kind, t.publishStatus),
  ],
);
