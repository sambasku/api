import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import { searchDayWib } from '@/shared/database/drizzle/schema/search-daily.schema';
import { usahaViews } from '@/shared/database/drizzle/schema/usaha-views.schema';
import { usahaCategories } from '@/shared/database/drizzle/schema/usaha-categories.schema';
import { usahas } from '@/shared/database/drizzle/schema/usahas.schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type {
  UsahaViewReport,
  UsahaViewsRepository,
} from '../domain/repositories/usaha-views.repository';

function dayOffset(days: number): string {
  return searchDayWib(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
}

export class UsahaViewsRepositoryImpl implements UsahaViewsRepository {
  constructor(private readonly db: AppDatabase) {}

  async recordViewBySlug(slug: string, viewerKey: string): Promise<void> {
    await this.db.run(sql`
      INSERT INTO usaha_views (usaha_id, day, viewer_key, count)
      SELECT id, ${searchDayWib(new Date())}, ${viewerKey}, 1
      FROM usahas
      WHERE slug = ${slug}
        AND publish_status = 'published'
        AND deleted_at IS NULL
      ON CONFLICT (usaha_id, day, viewer_key) DO NOTHING
    `);
  }

  async viewTotals(days: number | null): Promise<Map<string, number>> {
    const conds = days != null ? [gte(usahaViews.day, dayOffset(days))] : [];
    const rows = await this.db
      .select({
        usahaId: usahaViews.usahaId,
        total: sql<number>`count(*)`.mapWith(Number),
      })
      .from(usahaViews)
      .where(conds.length > 0 ? and(...conds) : undefined)
      .groupBy(usahaViews.usahaId);
    return new Map(rows.map((r) => [r.usahaId, r.total]));
  }

  async viewReport(days: number): Promise<UsahaViewReport> {
    const from = dayOffset(days);
    const perUsahaRows = await this.db
      .select({
        usahaId: usahaViews.usahaId,
        name: usahas.name,
        slug: usahas.slug,
        categoryName: usahaCategories.name,
        views: sql<number>`count(*)`.mapWith(Number),
        lastViewed: sql<string>`max(${usahaViews.day})`,
      })
      .from(usahaViews)
      .innerJoin(usahas, eq(usahas.id, usahaViews.usahaId))
      .leftJoin(usahaCategories, eq(usahas.categoryId, usahaCategories.id))
      .where(
        and(
          gte(usahaViews.day, from),
          eq(usahas.publishStatus, 'published'),
          isNull(usahas.deletedAt),
        ),
      )
      .groupBy(usahaViews.usahaId)
      .orderBy(sql`count(*) desc`);
    const trendRows = await this.db
      .select({
        day: usahaViews.day,
        total: sql<number>`count(*)`.mapWith(Number),
      })
      .from(usahaViews)
      .where(gte(usahaViews.day, from))
      .groupBy(usahaViews.day)
      .orderBy(usahaViews.day);
    return {
      trend: trendRows.map((r) => ({ day: r.day, total: r.total })),
      items: perUsahaRows.map((r) => ({
        usahaId: r.usahaId,
        name: r.name,
        slug: r.slug,
        categoryName: r.categoryName ?? null,
        views: r.views,
        lastViewed: r.lastViewed ?? null,
      })),
    };
  }
}