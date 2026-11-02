import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { pantunReports } from '@/shared/database/drizzle/schema/pantun-reports.schema';
import { pantunReplies, pantuns, users } from '@/shared/database/drizzle/schema';
import { generateId } from '@/shared/utils/ulid';
import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type { PantunReportTarget } from '@/shared/database/drizzle/schema/pantun-reports.schema';
import type {
  PantunReport,
  PantunReportWithTarget,
} from '../domain/entities/pantun-report.entity';
import type {
  PantunReportListFilter,
  PantunReportRepository,
} from '../domain/repositories/pantun-report.repository';

type ReportRow = typeof pantunReports.$inferSelect;

interface JoinedRow {
  report: ReportRow;
  reporterUsername: string | null;
  reporterDisplayName: string | null;
  pantunLines: string[] | null;
  pantunStatus: string | null;
  pantunUserId: string | null;
  replyLines: string[] | null;
  replyStatus: string | null;
  replyUserId: string | null;
  targetUsername: string | null;
  targetDisplayName: string | null;
}

function toLines(raw: unknown): string[] | null {
  return Array.isArray(raw) ? raw.map((x) => String(x)) : null;
}

function mapRow(row: ReportRow): PantunReport {
  return {
    id: row.id,
    targetType: row.targetType,
    targetId: row.targetId,
    userId: row.userId,
    username: null,
    displayName: null,
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

/**
 * Satu query: LEFT JOIN dua tabel target + pelapor + author target
 * (alias users kedua), sesuai aturan AGENTS #26 (tanpa N+1).
 */
export class PantunReportRepositoryImpl implements PantunReportRepository {
  constructor(private readonly db: AppDatabase) {}

  private selectJoined() {
    const targetAuthor = alias(users, 'target_author');
    return this.db
      .select({
        report: pantunReports,
        reporterUsername: users.username,
        reporterDisplayName: users.displayName,
        pantunLines: pantuns.lines,
        pantunStatus: pantuns.status,
        pantunUserId: pantuns.userId,
        replyLines: pantunReplies.lines,
        replyStatus: pantunReplies.status,
        replyUserId: pantunReplies.userId,
        targetUsername: targetAuthor.username,
        targetDisplayName: targetAuthor.displayName,
      })
      .from(pantunReports)
      .leftJoin(
        pantuns,
        and(
          eq(pantunReports.targetType, 'pantun'),
          eq(pantuns.id, pantunReports.targetId),
        ),
      )
      .leftJoin(
        pantunReplies,
        and(
          eq(pantunReports.targetType, 'pantun_reply'),
          eq(pantunReplies.id, pantunReports.targetId),
        ),
      )
      .leftJoin(users, eq(users.id, pantunReports.userId))
      .leftJoin(
        targetAuthor,
        sql`${targetAuthor.id} = COALESCE(${pantuns.userId}, ${pantunReplies.userId})`,
      );
  }

  async create(input: {
    targetType: PantunReportTarget;
    targetId: string;
    userId: string;
    reasonCode: string;
    note?: string | null;
  }): Promise<PantunReport> {
    const id = generateId();
    await this.db.insert(pantunReports).values({
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
      .from(pantunReports)
      .where(eq(pantunReports.id, id))
      .limit(1);
    if (!row) throw new Error('pantun report insert failed');
    return mapRow(row);
  }

  async findById(id: string): Promise<PantunReportWithTarget | null> {
    const [row] = await this.selectJoined()
      .where(eq(pantunReports.id, id))
      .limit(1);
    return row ? toWithTarget(row) : null;
  }

  async findOpenByUser(
    targetType: PantunReportTarget,
    targetId: string,
    userId: string,
  ): Promise<PantunReport | null> {
    const [row] = await this.db
      .select()
      .from(pantunReports)
      .where(
        and(
          eq(pantunReports.targetType, targetType),
          eq(pantunReports.targetId, targetId),
          eq(pantunReports.userId, userId),
          eq(pantunReports.status, 'open'),
        ),
      )
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async list(
    filter: PantunReportListFilter,
  ): Promise<CursorPage<PantunReportWithTarget>> {
    const rows = await this.selectJoined()
      .where(
        and(
          filter.status ? eq(pantunReports.status, filter.status) : undefined,
          filter.cursor ? lt(pantunReports.id, filter.cursor) : undefined,
        ),
      )
      .orderBy(desc(pantunReports.id))
      .limit(filter.limit + 1);

    const hasMore = rows.length > filter.limit;
    const page = hasMore ? rows.slice(0, filter.limit) : rows;
    const items = page.map(toWithTarget);
    return {
      items,
      nextCursor: hasMore && items.length > 0 ? items[items.length - 1].id : null,
      hasMore,
    };
  }

  async resolve(input: {
    id: string;
    status: 'resolved' | 'dismissed';
    resolution: 'dismissed' | 'taken_down';
    resolutionNote?: string | null;
    resolvedBy: string;
  }): Promise<boolean> {
    const now = new Date();
    const updated = await this.db
      .update(pantunReports)
      .set({
        status: input.status,
        resolution: input.resolution,
        resolutionNote: input.resolutionNote ?? null,
        resolvedBy: input.resolvedBy,
        resolvedAt: now,
        updatedAt: now,
      })
      .where(
        and(eq(pantunReports.id, input.id), eq(pantunReports.status, 'open')),
      )
      .returning({ id: pantunReports.id });
    return updated.length > 0;
  }

  async resolveAllOpenForTarget(input: {
    targetType: PantunReportTarget;
    targetId: string;
    resolutionNote?: string | null;
    resolvedBy: string;
  }): Promise<void> {
    const now = new Date();
    await this.db
      .update(pantunReports)
      .set({
        status: 'resolved',
        resolution: 'taken_down',
        resolutionNote: input.resolutionNote ?? null,
        resolvedBy: input.resolvedBy,
        resolvedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(pantunReports.targetType, input.targetType),
          eq(pantunReports.targetId, input.targetId),
          eq(pantunReports.status, 'open'),
        ),
      );
  }
}

/**
 * Baris gabungan -> entitas (satu query, tanpa N+1).
 */
function toWithTarget(row: JoinedRow): PantunReportWithTarget {
  const base = mapRow(row.report);
  const isReply = row.report.targetType === 'pantun_reply';
  return {
    ...base,
    username: row.reporterUsername,
    displayName: row.reporterDisplayName?.trim() || row.reporterUsername,
    targetLines: toLines(isReply ? row.replyLines : row.pantunLines),
    targetStatus: (isReply ? row.replyStatus : row.pantunStatus) ?? null,
    targetUserId: (isReply ? row.replyUserId : row.pantunUserId) ?? null,
    targetUsername: row.targetUsername,
    targetDisplayName: row.targetDisplayName,
  };
}
