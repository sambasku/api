import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { jinyeReports } from '@/shared/database/drizzle/schema/jinye-reports.schema';
import { jinye, jinyeComments, users } from '@/shared/database/drizzle/schema';
import { generateId } from '@/shared/utils/ulid';
import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type { JinyeReportTarget } from '@/shared/database/drizzle/schema/jinye-reports.schema';
import type {
  JinyeReport,
  JinyeReportWithTarget,
} from '../domain/entities/jinye-report.entity';
import type {
  JinyeReportListFilter,
  JinyeReportRepository,
} from '../domain/repositories/jinye-report.repository';

type ReportRow = typeof jinyeReports.$inferSelect;

interface JoinedRow {
  report: ReportRow;
  reporterUsername: string | null;
  reporterDisplayName: string | null;
  jinyeBody: string | null;
  jinyeImages: unknown;
  jinyeAudioUrl: string | null;
  jinyeStatus: string | null;
  jinyeUserId: string | null;
  commentBody: string | null;
  commentImages: unknown;
  commentStatus: string | null;
  commentUserId: string | null;
  targetUsername: string | null;
  targetDisplayName: string | null;
}

function hasImages(raw: unknown): boolean {
  return Array.isArray(raw) && raw.length > 0;
}

function mapRow(row: ReportRow): JinyeReport {
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

function toWithTarget(row: JoinedRow): JinyeReportWithTarget {
  const base = mapRow(row.report);
  const isComment = row.report.targetType === 'jinye_comment';
  const body = (isComment ? row.commentBody : row.jinyeBody) ?? null;
  return {
    ...base,
    username: row.reporterUsername,
    displayName: row.reporterDisplayName?.trim() || row.reporterUsername,
    targetBody: body,
    targetHasImages: hasImages(isComment ? row.commentImages : row.jinyeImages),
    targetHasAudio: !isComment && !!row.jinyeAudioUrl,
    targetStatus: (isComment ? row.commentStatus : row.jinyeStatus) ?? null,
    targetUserId: (isComment ? row.commentUserId : row.jinyeUserId) ?? null,
    targetUsername: row.targetUsername,
    targetDisplayName: row.targetDisplayName,
  };
}

/** Satu query JOIN target + pelapor + author (tanpa N+1). */
export class JinyeReportRepositoryImpl implements JinyeReportRepository {
  constructor(private readonly db: AppDatabase) {}

  private selectJoined() {
    const targetAuthor = alias(users, 'target_author');
    return this.db
      .select({
        report: jinyeReports,
        reporterUsername: users.username,
        reporterDisplayName: users.displayName,
        jinyeBody: jinye.body,
        jinyeImages: jinye.images,
        jinyeAudioUrl: jinye.audioUrl,
        jinyeStatus: jinye.status,
        jinyeUserId: jinye.userId,
        commentBody: jinyeComments.body,
        commentImages: jinyeComments.images,
        commentStatus: jinyeComments.status,
        commentUserId: jinyeComments.userId,
        targetUsername: targetAuthor.username,
        targetDisplayName: targetAuthor.displayName,
      })
      .from(jinyeReports)
      .leftJoin(
        jinye,
        and(
          eq(jinyeReports.targetType, 'jinye'),
          eq(jinye.id, jinyeReports.targetId),
        ),
      )
      .leftJoin(
        jinyeComments,
        and(
          eq(jinyeReports.targetType, 'jinye_comment'),
          eq(jinyeComments.id, jinyeReports.targetId),
        ),
      )
      .leftJoin(users, eq(users.id, jinyeReports.userId))
      .leftJoin(
        targetAuthor,
        sql`${targetAuthor.id} = COALESCE(${jinye.userId}, ${jinyeComments.userId})`,
      );
  }

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

  async findById(id: string): Promise<JinyeReportWithTarget | null> {
    const [row] = await this.selectJoined()
      .where(eq(jinyeReports.id, id))
      .limit(1);
    return row ? toWithTarget(row) : null;
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

  async list(
    filter: JinyeReportListFilter,
  ): Promise<CursorPage<JinyeReportWithTarget>> {
    const rows = await this.selectJoined()
      .where(
        and(
          filter.status ? eq(jinyeReports.status, filter.status) : undefined,
          filter.cursor ? lt(jinyeReports.id, filter.cursor) : undefined,
        ),
      )
      .orderBy(desc(jinyeReports.id))
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
      .update(jinyeReports)
      .set({
        status: input.status,
        resolution: input.resolution,
        resolutionNote: input.resolutionNote ?? null,
        resolvedBy: input.resolvedBy,
        resolvedAt: now,
        updatedAt: now,
      })
      .where(
        and(eq(jinyeReports.id, input.id), eq(jinyeReports.status, 'open')),
      )
      .returning({ id: jinyeReports.id });
    return updated.length > 0;
  }

  async resolveAllOpenForTarget(input: {
    targetType: JinyeReportTarget;
    targetId: string;
    resolutionNote?: string | null;
    resolvedBy: string;
  }): Promise<void> {
    const now = new Date();
    await this.db
      .update(jinyeReports)
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
          eq(jinyeReports.targetType, input.targetType),
          eq(jinyeReports.targetId, input.targetId),
          eq(jinyeReports.status, 'open'),
        ),
      );
  }
}
