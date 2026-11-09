import { and, eq } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { jinyeReports } from '@/shared/database/drizzle/schema/jinye-reports.schema';
import { generateId } from '@/shared/utils/ulid';
import type { JinyeReportTarget } from '@/shared/database/drizzle/schema/jinye-reports.schema';
import type { JinyeReport } from '../domain/entities/jinye-report.entity';
import type { JinyeReportRepository } from '../domain/repositories/jinye-report.repository';

type ReportRow = typeof jinyeReports.$inferSelect;

function mapRow(row: ReportRow): JinyeReport {
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

export class JinyeReportRepositoryImpl implements JinyeReportRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: {
    targetType: JinyeReportTarget;
    targetId: string;
    userId: string;
    reasonCode: string;
    note?: string | null;
  }): Promise<JinyeReport> {
    const id = generateId();
    await this.db.insert(jinyeReports).values({
      id,
      targetType: input.targetType,
      targetId: input.targetId,
      userId: input.userId,
      reasonCode: input.reasonCode as ReportRow['reasonCode'],
      note: input.note ?? null,
      status: 'open',
    });
    const [row] = await this.db
      .select()
      .from(jinyeReports)
      .where(eq(jinyeReports.id, id))
      .limit(1);
    if (!row) throw new Error('jinye report insert failed');
    return mapRow(row);
  }

  async findOpenByUser(
    targetType: JinyeReportTarget,
    targetId: string,
    userId: string,
  ): Promise<JinyeReport | null> {
    const [row] = await this.db
      .select()
      .from(jinyeReports)
      .where(
        and(
          eq(jinyeReports.targetType, targetType),
          eq(jinyeReports.targetId, targetId),
          eq(jinyeReports.userId, userId),
          eq(jinyeReports.status, 'open'),
        ),
      )
      .limit(1);
    return row ? mapRow(row) : null;
  }
}
