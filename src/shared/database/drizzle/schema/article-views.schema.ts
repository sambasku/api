import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
} from 'drizzle-orm/sqlite-core';
import { articles } from './encyclopedia.schema';

/**
 * Viewer unik yang membuka artikel ensiklopedia per hari WIB (docs/api/62-api-article-views.md).
 */
export const articleViews = sqliteTable(
  'article_views',
  {
    articleId: text('article_id')
      .notNull()
      .references(() => articles.id),
    day: text('day').notNull(),
    viewerKey: text('viewer_key').notNull(),
    count: integer('count').notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.articleId, t.day, t.viewerKey] }),
    index('article_views_day_idx').on(t.day),
  ],
);