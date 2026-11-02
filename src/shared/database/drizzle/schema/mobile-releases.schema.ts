import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Versi build mobile terbaru per platform (issue mobile#196).
 * Satu baris per platform (UNIQUE); admin upsert dari console
 * System > Mobile Release. Mobile membandingkan dengan PackageInfo.
 */
export const mobileReleases = sqliteTable('mobile_releases', {
  id: text('id').primaryKey(),
  platform: text('platform', { enum: ['android', 'ios'] }).notNull().unique(),
  version: text('version').notNull(),
  storeUrl: text('store_url'),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});
