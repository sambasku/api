import { and, eq, gte, sql } from 'drizzle-orm';
import { searchDayWib } from '@/shared/database/drizzle/schema/search-daily.schema';
import { layananViews } from '@/shared/database/drizzle/schema/layanan-views.schema';
import { layanans } from '@/shared/database/drizzle/schema/layanans.schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type {
  LayananViewReport,
  LayananViewsRepository,
} from '../domain/repositories/layanan-views.repository';

function dayOffset(days: number): string {
  return searchDayWib(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
}

export class LayananViewsRepositoryImpl implements LayananViewsRepository {
  constructor(private readonly db: AppDatabase) {}

  async recordViewBySlug(slug: string, viewerKey: string): Promise<void> {
    await this.db.run(sql`
      INSERT INTO layanan_views (layanan_id, day, viewer_key, count)
      SELECT id, ${searchDayWib(new Date())}, ${viewerKey}, 1
      FROM layanans
      WHERE slug = ${slug}
        AND publish_status = 'published'
      ON CONFLICT (layanan_id, day, viewer_key) DO NOTHING
    `);
  }

  async viewTotals(days: number | null): Promise<Map<string, number>> {
    const conds = days != null ? [gte(layananViews.day, dayOffset(days))] : [];
    const rows = await this.db
      .select({
        layananId: layananViews.layananId,
        total: sql<number>`count(*)`.mapWith(Number),
      })
      .from(layananViews)
      .where(conds.length > 0 ? and(...conds) : undefined)
      .groupBy(layananViews.layananId);
    return new Map(rows.map((r) => [r.layananId, r.total]));
  }

  async viewReport(days: number): Promise<LayananViewReport> {
    const from = dayOffset(days);
    const perLayananRows = await this.db
      .select({
        layananId: layananViews.layananId,
        name: layanans.name,
        slug: layanans.slug,
        category: layanans.category,
        views: sql<number>`count(*)`.mapWith(Number),
        lastViewed: sql<string>`max(${layananViews.day})`,
      })
      .from(layananViews)
      .innerJoin(layanans, eq(layanans.id, layananViews.layananId))
      .where(and(gte(layananViews.day, from), eq(layanans.publishStatus, 'published')))
      .groupBy(layananViews.layananId)
      .orderBy(sql`count(*) desc`);
    const trendRows = await this.db
      .select({
        day: layananViews.day,
        total: sql<number>`count(*)`.mapWith(Number),
      })
      .from(layananViews)
      .where(gte(layananViews.day, from))
      .groupBy(layananViews.day)
      .orderBy(layananViews.day);
    return {
      trend: trendRows.map((r) => ({ day: r.day, total: r.total })),
      items: perLayananRows.map((r) => ({
        layananId: r.layananId,
        name: r.name,
        slug: r.slug,
        category: r.category,
        views: r.views,
        lastViewed: r.lastViewed ?? null,
      })),
    };
  }
}