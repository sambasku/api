import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';

export const COMMUNITY_CATEGORIES = [
  'seni',
  'bahasa',
  'pendidikan',
  'ukm',
  'lain',
] as const;
export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number];

export const COMMUNITY_PUBLISH_STATUSES = ['published', 'archived'] as const;
export type CommunityPublishStatus =
  (typeof COMMUNITY_PUBLISH_STATUSES)[number];

export const COMMUNITY_FEATURED_KINDS = ['tim', 'sponsor'] as const;
export type CommunityFeaturedKind = (typeof COMMUNITY_FEATURED_KINDS)[number];

/**
 * Direktori komunitas / organisasi Sambas (fase 1).
 * Sorotan: tepat satu baris `tim` dan satu `sponsor` via unique partial.
 */
export const communityOrgs = sqliteTable(
  'community_orgs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    category: text('category', { enum: COMMUNITY_CATEGORIES })
      .notNull()
      .default('lain'),
    description: text('description').notNull().default(''),
    logoUrl: text('logo_url'),
    coverUrl: text('cover_url'),
    status: text('status', { enum: COMMUNITY_PUBLISH_STATUSES })
      .notNull()
      .default('published'),
    /** null = bukan kartu Sorotan. Max 1 `tim` + 1 `sponsor`. */
    isFeaturedKind: text('is_featured_kind', {
      enum: COMMUNITY_FEATURED_KINDS,
    }),
    authorId: text('author_id'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
  },
  (t) => [
    uniqueIndex('community_orgs_slug_uidx').on(t.slug),
    index('community_orgs_status_category_idx').on(t.status, t.category),
    index('community_orgs_status_created_idx').on(t.status, t.createdAt),
    uniqueIndex('community_orgs_featured_kind_uidx')
      .on(t.isFeaturedKind)
      .where(sql`is_featured_kind is not null`),
  ],
);
