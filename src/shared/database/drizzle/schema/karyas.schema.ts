import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { kreators } from './kreators.schema';

export const KARYA_KINDS = ['music', 'film'] as const;
export type KaryaKind = (typeof KARYA_KINDS)[number];

export const KARYA_PUBLISH_STATUSES = [
  'draft',
  'published',
  'archived',
  'restricted',
] as const;
export type KaryaPublishStatus = (typeof KARYA_PUBLISH_STATUSES)[number];

export const KARYA_MUSIC_RELEASE_TYPES = [
  'single',
  'album_track',
  'other',
] as const;
export type KaryaMusicReleaseType = (typeof KARYA_MUSIC_RELEASE_TYPES)[number];

export const KARYA_FILM_TYPES = [
  'feature',
  'short',
  'documentary',
  'other',
] as const;
export type KaryaFilmType = (typeof KARYA_FILM_TYPES)[number];

export const KARYA_MUSIC_CREDIT_ROLES = [
  'vocal',
  'feat',
  'songwriter',
  'composer',
  'producer',
  'arranger',
  'band_member',
  'other',
] as const;
export type KaryaMusicCreditRole = (typeof KARYA_MUSIC_CREDIT_ROLES)[number];

export const KARYA_FILM_CREDIT_ROLES = [
  'director',
  'cast',
  'writer',
  'producer',
  'cinematographer',
  'composer',
  'other',
] as const;
export type KaryaFilmCreditRole = (typeof KARYA_FILM_CREDIT_ROLES)[number];

/** Role disimpan teks; validasi per `kind` di validator (musik vs film). */
export type KaryaCreditRole =
  | KaryaMusicCreditRole
  | KaryaFilmCreditRole;

/**
 * Katalog Karya (PRD docs/backlogs/KARYA.md) - fase 1 Musik + Film.
 * Field spesifik musik/film nullable di baris yang sama (hindari JOIN
 * ekstra di read-path Worker).
 */
export const karyas = sqliteTable(
  'karyas',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    kind: text('kind', { enum: KARYA_KINDS }).notNull(),
    /** Tahun rilis (Gregorian); null = belum diketahui. */
    year: integer('year'),
    /** Kode bahasa (mis. sbs, id); opsional. */
    language: text('language'),
    description: text('description'),
    coverUrl: text('cover_url'),
    /** JSON ImageAttribution-like; null = tanpa atribusi. */
    coverAttributionJson: text('cover_attribution_json'),
    /**
     * JSON `[{ type, note }]` - type:
     * creator_origin | language | location | theme | other.
     * Opsional (boleh kosong di usulan dan publish).
     */
    sambasConnectionsJson: text('sambas_connections_json')
      .notNull()
      .default('[]'),
    /**
     * JSON `[{ kind, label, url, is_primary? }]`.
     * kind: listen|watch|buy|read|stream|official|other. URL bersih.
     */
    accessLinksJson: text('access_links_json').notNull().default('[]'),
    /** JSON sumber katalog/data (bukan access link). */
    sourcesJson: text('sources_json').notNull().default('[]'),
    /**
     * JSON `{ kind, slug|id }[]` - place|word|article|event|usaha|
     * kreator|karya. Parser skip kind belum hidup.
     */
    relatedJson: text('related_json').notNull().default('[]'),
    /** Musik: single | album_track | other. */
    musicReleaseType: text('music_release_type', {
      enum: KARYA_MUSIC_RELEASE_TYPES,
    }),
    musicDurationMs: integer('music_duration_ms'),
    musicIsCover: integer('music_is_cover', { mode: 'boolean' })
      .notNull()
      .default(false),
    /** Film: feature | short | documentary | other. */
    filmType: text('film_type', { enum: KARYA_FILM_TYPES }),
    filmRuntimeMin: integer('film_runtime_min'),
    publishStatus: text('publish_status', { enum: KARYA_PUBLISH_STATUSES })
      .notNull()
      .default('draft'),
    restrictedReason: text('restricted_reason'),
    restrictedAt: integer('restricted_at', { mode: 'timestamp' }),
    /** Pengusul; null = admin seed. */
    authorId: text('author_id'),
    publishedAt: integer('published_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (t) => [
    uniqueIndex('karyas_slug_uidx').on(t.slug),
    index('karyas_publish_status_idx').on(t.publishStatus),
    index('karyas_status_kind_idx').on(t.publishStatus, t.kind),
    index('karyas_status_year_idx').on(t.publishStatus, t.year),
    index('karyas_title_idx').on(t.title),
    index('karyas_status_updated_at_idx').on(t.publishStatus, t.updatedAt),
  ],
);

/**
 * Credit karya. Karya-first: `name_text` wajib; `kreator_id` nullable
 * sampai G4 resolve/klaim.
 */
export const karyaCredits = sqliteTable(
  'karya_credits',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    karyaId: text('karya_id')
      .notNull()
      .references(() => karyas.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    nameText: text('name_text').notNull(),
    kreatorId: text('kreator_id').references(() => kreators.id),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('karya_credits_karya_sort_idx').on(t.karyaId, t.sortOrder),
    index('karya_credits_kreator_idx').on(t.kreatorId),
    index('karya_credits_role_idx').on(t.karyaId, t.role),
  ],
);
