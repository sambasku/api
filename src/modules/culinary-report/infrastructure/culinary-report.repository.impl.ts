import { and, desc, eq } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { culinaryReports } from '@/shared/database/drizzle/schema/culinary-reports.schema';
import { culinaryPlaces } from '@/shared/database/drizzle/schema/culinary-places.schema';
import { cuisines } from '@/shared/database/drizzle/schema/cuisines.schema';
import { generateId } from '@/shared/utils/ulid';
import type {
  CulinaryReport,
  CulinaryReportWithTarget,
} from '../domain/culinary-report.entity';
import type { CulinaryReportRepository } from '../domain/culinary-report.repository';

type Row = typeof culinaryReports.$inferSelect;

function mapRow(row: Row): CulinaryReport {
  return {
    id: row.id,
    targetType: row.targetType,
    targetId: row.targetId,
    userId: row.userId,
    reasonCode: row.reasonCode,
    note: row.note ?? null,
    status: row.status,
    resolution: row.resolution ?? null,
    resolutionNote: row.resolutionNote ?? null,
    resolvedBy: row.resolvedBy ?? null,
    resolvedAt: row.resolvedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
  };
}

export class CulinaryReportRepositoryImpl implements CulinaryReportRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: {
    targetType: 'cuisine' | 'place';
    targetId: string;
    userId: string;
    reasonCode: string;
    note?: string | null;
  }): Promise<CulinaryReport> {
    const id = generateId();
    await this.db.insert(culinaryReports).values({
      id,
      targetType: input.targetType,
      targetId: input.targetId,
      userId: input.userId,
      reasonCode: input.reasonCode,
      note: input.note ?? null,
      status: 'open',
    });
    const created = await this.findById(id);
    if (!created) throw new Error('culinary report insert failed');
    return created;
  }

  async findById(id: string): Promise<CulinaryReport | null> {
    const [row] = await this.db
      .select()
      .from(culinaryReports)
      .where(eq(culinaryReports.id, id))
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async findOpenByUser(
    targetType: 'cuisine' | 'place',
    targetId: string,
    userId: string,
  ): Promise<CulinaryReport | null> {
    const [row] = await this.db
      .select()
      .from(culinaryReports)
      .where(
        and(
          eq(culinaryReports.targetType, targetType),
          eq(culinaryReports.targetId, targetId),
          eq(culinaryReports.userId, userId),
          eq(culinaryReports.status, 'open'),
        ),
      )
      .limit(1);
    return row ? mapRow(row) : null;
  }

  /** Satu query: LEFT JOIN kedua tabel target, guard kind by target_type. */
  async list(status?: string): Promise<CulinaryReportWithTarget[]> {
    const rows = await this.db
      .select({
        row: culinaryReports,
        cuisineName: cuisines.name,
        cuisineSlug: cuisines.slug,
        placeName: culinaryPlaces.name,
        placeSlug: culinaryPlaces.slug,
      })
      .from(culinaryReports)
      .leftJoin(
        cuisines,
        and(
          eq(culinaryReports.targetType, 'cuisine'),
          eq(cuisines.id, culinaryReports.targetId),
        ),
      )
      .leftJoin(
        culinaryPlaces,
        and(
          eq(culinaryReports.targetType, 'place'),
          eq(culinaryPlaces.id, culinaryReports.targetId),
        ),
      )
      .where(status ? eq(culinaryReports.status, status) : undefined)
      .orderBy(desc(culinaryReports.createdAt))
      .limit(100);
    return rows.map((r) => ({
      ...mapRow(r.row),
      targetName: r.cuisineName ?? r.placeName ?? null,
      targetSlug: r.cuisineSlug ?? r.placeSlug ?? null,
    }));
  }

  async resolve(input: {
    id: string;
    status: 'resolved' | 'dismissed';
    resolution: string;
    resolutionNote?: string | null;
    resolvedBy: string;
  }): Promise<void> {
    await this.db
      .update(culinaryReports)
      .set({
        status: input.status,
        resolution: input.resolution,
        resolutionNote: input.resolutionNote ?? null,
        resolvedBy: input.resolvedBy,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(culinaryReports.id, input.id));
  }
}
