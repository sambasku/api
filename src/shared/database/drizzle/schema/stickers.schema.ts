import { sql } from 'drizzle-orm';
import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { users } from './users.schema';

/**
 * Katalog stiker bersama (chat + komentar) + custom stiker privat per user.
 * PK = slug stabil (cheer, wave, ...) atau `<slug>-<ulid>` untuk custom stiker.
 */
export const stickers = sqliteTable(
  'stickers',
  {
    id: text('id').primaryKey(),
    imageUrl: text('image_url').notNull(),
    playOnce: integer('play_once', { mode: 'boolean' }).notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    /** Slug kategori berbagi; null = hanya di tab Semua. */
    categorySlug: text('category_slug'),
    /** Pemilik custom stiker; null = stiker katalog resmi. */
    ownerUserId: text('owner_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    /** Nama tampilan opsional (terutama untuk custom stiker). */
    displayName: text('display_name'),
    /** 'public' = tampil di katalog global; 'private' = hanya di deck pemilik + favorit. */
    visibility: text('visibility').notNull().default('public'),
    /** ID file di storage (ImageKit) untuk penghapusan fisik saat takedown/hapus. */
    providerFileId: text('provider_file_id'),
    /** Asal salinan hasil fork saat favorit; null = stiker asli. */
    sourceStickerId: text('source_sticker_id'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('stickers_active_sort_idx')
      .on(t.isActive, t.sortOrder, t.id)
      .where(sql`deleted_at is null`),
    index('stickers_active_category_sort_idx')
      .on(t.isActive, t.categorySlug, t.sortOrder, t.id)
      .where(sql`deleted_at is null`),
    index('stickers_owner_active_idx')
      .on(t.ownerUserId, t.createdAt)
      .where(sql`deleted_at is null`),
    // Satu salinan aktif per (favoriter, asal): cegah duplikat saat tap ganda.
    uniqueIndex('stickers_owner_source_uniq')
      .on(t.ownerUserId, t.sourceStickerId)
      .where(sql`source_sticker_id is not null and deleted_at is null`),
  ],
);

/**
 * Favorit stiker per user (katalog resmi maupun custom stiker dari chat/komentar).
 */
export const userStickerFavorites = sqliteTable(
  'user_sticker_favorites',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    stickerId: text('sticker_id')
      .notNull()
      .references(() => stickers.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.stickerId] }),
    index('user_sticker_favorites_user_created_idx').on(t.userId, t.createdAt),
  ],
);
