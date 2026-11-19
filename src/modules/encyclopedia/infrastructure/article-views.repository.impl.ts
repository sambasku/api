import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import { searchDayWib } from '@/shared/database/drizzle/schema/search-daily.schema';
import { articleViews } from '@/shared/database/drizzle/schema/article-views.schema';
import {
  articles,
  encyclopediaCategories,
} from '@/shared/database/drizzle/schema/encyclopedia.schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type {
  ArticleViewReport,
  ArticleViewsRepository,
} from '../domain/repositories/article-views.repository';

function dayOffset(days: number): string {
  return searchDayWib(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
}

export class ArticleViewsRepositoryImpl implements ArticleViewsRepository {
  constructor(private readonly db: AppDatabase) {}

  async recordViewBySlug(slug: string, viewerKey: string): Promise<void> {
    await this.db.run(sql`
      INSERT INTO article_views (article_id, day, viewer_key, count)
      SELECT id, ${searchDayWib(new Date())}, ${viewerKey}, 1
      FROM articles
      WHERE slug = ${slug}
        AND status = 'published'
        AND deleted_at IS NULL
      ON CONFLICT (article_id, day, viewer_key) DO NOTHING
    `);
  }

  async viewTotals(days: number | null): Promise<Map<string, number>> {
    const conds = days != null ? [gte(articleViews.day, dayOffset(days))] : [];
    const rows = await this.db
      .select({
        articleId: articleViews.articleId,
        total: sql<number>`count(*)`.mapWith(Number),
      })
      .from(articleViews)
      .where(conds.length > 0 ? and(...conds) : undefined)
      .groupBy(articleViews.articleId);
    return new Map(rows.map((r) => [r.articleId, r.total]));
  }

  async viewReport(days: number): Promise<ArticleViewReport> {
    const from = dayOffset(days);
    const perArticleRows = await this.db
      .select({
        articleId: articleViews.articleId,
        name: articles.title,
        slug: articles.slug,
        categoryName: encyclopediaCategories.name,
        views: sql<number>`count(*)`.mapWith(Number),
        lastViewed: sql<string>`max(${articleViews.day})`,
      })
      .from(articleViews)
      .innerJoin(articles, eq(articles.id, articleViews.articleId))
      .leftJoin(
        encyclopediaCategories,
        eq(articles.categoryId, encyclopediaCategories.id),
      )
      .where(
        and(
          gte(articleViews.day, from),
          eq(articles.status, 'published'),
          isNull(articles.deletedAt),
        ),
      )
      .groupBy(articleViews.articleId)
      .orderBy(sql`count(*) desc`);
    const trendRows = await this.db
      .select({
        day: articleViews.day,
        total: sql<number>`count(*)`.mapWith(Number),
      })
      .from(articleViews)
      .where(gte(articleViews.day, from))
      .groupBy(articleViews.day)
      .orderBy(articleViews.day);
    return {
      trend: trendRows.map((r) => ({ day: r.day, total: r.total })),
      items: perArticleRows.map((r) => ({
        articleId: r.articleId,
        name: r.name,
        slug: r.slug,
        categoryName: r.categoryName ?? null,
        views: r.views,
        lastViewed: r.lastViewed ?? null,
      })),
    };
  }
}