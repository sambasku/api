import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import { searchDayWib } from '@/shared/database/drizzle/schema/search-daily.schema';
import { cuisineViews } from '@/shared/database/drizzle/schema/cuisine-views.schema';
import { culinaryCategories } from '@/shared/database/drizzle/schema/culinary-categories.schema';
import { cuisines } from '@/shared/database/drizzle/schema/cuisines.schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type {
  CuisineViewReport,
  CuisineViewsRepository,
} from '../domain/repositories/cuisine-views.repository';

function dayOffset(days: number): string {
  return searchDayWib(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
}

export class CuisineViewsRepositoryImpl implements CuisineViewsRepository {
  constructor(private readonly db: AppDatabase) {}

  async recordViewBySlug(slug: string, viewerKey: string): Promise<void> {
    await this.db.run(sql`
      INSERT INTO cuisine_views (cuisine_id, day, viewer_key, count)
      SELECT id, ${searchDayWib(new Date())}, ${viewerKey}, 1
      FROM cuisines
      WHERE slug = ${slug}
        AND publish_status = 'published'
        AND deleted_at IS NULL
      ON CONFLICT (cuisine_id, day, viewer_key) DO NOTHING
    `);
  }

  async viewTotals(days: number | null): Promise<Map<string, number>> {
    const conds = days != null ? [gte(cuisineViews.day, dayOffset(days))] : [];
    const rows = await this.db
      .select({
        cuisineId: cuisineViews.cuisineId,
        total: sql<number>`count(*)`.mapWith(Number),
      })
      .from(cuisineViews)
      .where(conds.length > 0 ? and(...conds) : undefined)
      .groupBy(cuisineViews.cuisineId);
    return new Map(rows.map((r) => [r.cuisineId, r.total]));
  }

  async viewReport(days: number): Promise<CuisineViewReport> {
    const from = dayOffset(days);
    const perCuisineRows = await this.db
      .select({
        cuisineId: cuisineViews.cuisineId,
        name: cuisines.name,
        slug: cuisines.slug,
        categoryName: culinaryCategories.name,
        views: sql<number>`count(*)`.mapWith(Number),
        lastViewed: sql<string>`max(${cuisineViews.day})`,
      })
      .from(cuisineViews)
      .innerJoin(cuisines, eq(cuisines.id, cuisineViews.cuisineId))
      .leftJoin(culinaryCategories, eq(cuisines.categoryId, culinaryCategories.id))
      .where(
        and(
          gte(cuisineViews.day, from),
          eq(cuisines.publishStatus, 'published'),
          isNull(cuisines.deletedAt),
        ),
      )
      .groupBy(cuisineViews.cuisineId)
      .orderBy(sql`count(*) desc`);
    const trendRows = await this.db
      .select({
        day: cuisineViews.day,
        total: sql<number>`count(*)`.mapWith(Number),
      })
      .from(cuisineViews)
      .where(gte(cuisineViews.day, from))
      .groupBy(cuisineViews.day)
      .orderBy(cuisineViews.day);
    return {
      trend: trendRows.map((r) => ({ day: r.day, total: r.total })),
      items: perCuisineRows.map((r) => ({
        cuisineId: r.cuisineId,
        name: r.name,
        slug: r.slug,
        categoryName: r.categoryName ?? null,
        views: r.views,
        lastViewed: r.lastViewed ?? null,
      })),
    };
  }
}