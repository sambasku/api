import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import { searchDayWib } from '@/shared/database/drizzle/schema/search-daily.schema';
import { karyaViews } from '@/shared/database/drizzle/schema/karya-views.schema';
import { karyas } from '@/shared/database/drizzle/schema/karyas.schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type {
  KaryaViewReport,
  KaryaViewsRepository,
} from '../domain/repositories/karya-views.repository';

function dayOffset(days: number): string {
  return searchDayWib(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
}

export class KaryaViewsRepositoryImpl implements KaryaViewsRepository {
  constructor(private readonly db: AppDatabase) {}

  async recordViewBySlug(slug: string, viewerKey: string): Promise<void> {
    await this.db.run(sql`
      INSERT INTO karya_views (karya_id, day, viewer_key, count)
      SELECT id, ${searchDayWib(new Date())}, ${viewerKey}, 1
      FROM karyas
      WHERE slug = ${slug}
        AND publish_status = 'published'
        AND deleted_at IS NULL
      ON CONFLICT (karya_id, day, viewer_key) DO NOTHING
    `);
  }

  async viewTotals(days: number | null): Promise<Map<string, number>> {
    const conds = days != null ? [gte(karyaViews.day, dayOffset(days))] : [];
    const rows = await this.db
      .select({
        karyaId: karyaViews.karyaId,
        total: sql<number>`count(*)`.mapWith(Number),
      })
      .from(karyaViews)
      .where(conds.length > 0 ? and(...conds) : undefined)
      .groupBy(karyaViews.karyaId);
    return new Map(rows.map((r) => [r.karyaId, r.total]));
  }

  async viewReport(days: number): Promise<KaryaViewReport> {
    const from = dayOffset(days);
    const perKaryaRows = await this.db
      .select({
        karyaId: karyaViews.karyaId,
        title: karyas.title,
        slug: karyas.slug,
        kind: karyas.kind,
        views: sql<number>`count(*)`.mapWith(Number),
        lastViewed: sql<string>`max(${karyaViews.day})`,
      })
      .from(karyaViews)
      .innerJoin(karyas, eq(karyas.id, karyaViews.karyaId))
      .where(
        and(
          gte(karyaViews.day, from),
          eq(karyas.publishStatus, 'published'),
          isNull(karyas.deletedAt),
        ),
      )
      .groupBy(karyaViews.karyaId)
      .orderBy(sql`count(*) desc`);
    const trendRows = await this.db
      .select({
        day: karyaViews.day,
        total: sql<number>`count(*)`.mapWith(Number),
      })
      .from(karyaViews)
      .where(gte(karyaViews.day, from))
      .groupBy(karyaViews.day)
      .orderBy(karyaViews.day);
    return {
      trend: trendRows.map((r) => ({ day: r.day, total: r.total })),
      items: perKaryaRows.map((r) => ({
        karyaId: r.karyaId,
        title: r.title,
        slug: r.slug,
        kind: r.kind,
        views: r.views,
        lastViewed: r.lastViewed ?? null,
      })),
    };
  }
}