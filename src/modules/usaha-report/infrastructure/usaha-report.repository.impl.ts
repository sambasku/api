import { and, desc, eq } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { usahaReports } from '@/shared/database/drizzle/schema/usaha-reports.schema';
import { usahas } from '@/shared/database/drizzle/schema/usahas.schema';
import { generateId } from '@/shared/utils/ulid';
import type {
  UsahaReport,
  UsahaReportWithUsaha,
} from '../domain/usaha-report.entity';
import type { UsahaReportRepository } from '../domain/usaha-report.repository';

type Row = typeof usahaReports.$inferSelect;

function mapRow(row: Row): UsahaReport {
  return {
    id: row.id,
    usahaId: row.usahaId,
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

export class UsahaReportRepositoryImpl implements UsahaReportRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: {
    usahaId: string;
    userId: string;
    reasonCode: string;
    note?: string | null;
  }): Promise<UsahaReport> {
    const id = generateId();
    await this.db.insert(usahaReports).values({
      id,
      usahaId: input.usahaId,
      userId: input.userId,
      reasonCode: input.reasonCode,
      note: input.note ?? null,
      status: 'open',
    });
    const created = await this.findById(id);
    if (!created) throw new Error('usaha report insert failed');
    return created;
  }

  async findById(id: string): Promise<UsahaReport | null> {
    const [row] = await this.db
      .select()
      .from(usahaReports)
      .where(eq(usahaReports.id, id))
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async findOpenByUser(
    usahaId: string,
    userId: string,
  ): Promise<UsahaReport | null> {
    const [row] = await this.db
      .select()
      .from(usahaReports)
      .where(
        and(
          eq(usahaReports.usahaId, usahaId),
          eq(usahaReports.userId, userId),
          eq(usahaReports.status, 'open'),
        ),
      )
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async list(status?: string): Promise<UsahaReportWithUsaha[]> {
    const rows = await this.db
      .select({
        row: usahaReports,
        usahaName: usahas.name,
        usahaSlug: usahas.slug,
      })
      .from(usahaReports)
      .innerJoin(usahas, eq(usahas.id, usahaReports.usahaId))
      .where(status ? eq(usahaReports.status, status) : undefined)
      .orderBy(desc(usahaReports.createdAt))
      .limit(100);
    return rows.map((r) => ({
      ...mapRow(r.row),
      usahaName: r.usahaName,
      usahaSlug: r.usahaSlug,
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
      .update(usahaReports)
      .set({
        status: input.status,
        resolution: input.resolution,
        resolutionNote: input.resolutionNote ?? null,
        resolvedBy: input.resolvedBy,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(usahaReports.id, input.id));
  }
}
