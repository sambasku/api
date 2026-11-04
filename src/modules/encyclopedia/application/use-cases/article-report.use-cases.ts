import { ConflictError, NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import {
  articleReports,
  type ArticleReportReason,
  type ArticleReportTarget,
} from '@/shared/database/drizzle/schema/encyclopedia.schema';
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type { ArticleRepository } from '../../domain/repositories/encyclopedia.repository';

export interface ArticleReport {
  id: string;
  targetType: ArticleReportTarget;
  targetId: string;
  userId: string;
  username: string | null;
  reasonCode: ArticleReportReason;
  note: string | null;
  status: 'open' | 'resolved' | 'dismissed';
  resolution: 'dismissed' | 'taken_down' | null;
  resolutionNote: string | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

export interface SubmitReportInput {
  userId: string;
  targetType: ArticleReportTarget;
  targetId: string;
  reasonCode: ArticleReportReason;
  note: string | null;
  requestId?: string | null;
}

/** Laporan artikel/komentar. Pola pantun-report: admin memutuskan. */
export class ArticleReportUseCases {
  constructor(
    private readonly db: AppDatabase,
    private readonly articleRepo: ArticleRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async submit(input: SubmitReportInput): Promise<ArticleReport> {
    const exists =
      input.targetType === 'article'
        ? await this.articleRepo.findById(input.targetId)
        : await this.articleRepo.findCommentById(input.targetId);
    if (!exists) {
      throw new NotFoundError(
        input.targetType === 'article'
          ? 'ARTICLE_NOT_FOUND'
          : 'COMMENT_NOT_FOUND',
        'Konten yang dilaporkan tidak ditemukan',
      );
    }
    const [row] = await this.db
      .insert(articleReports)
      .values({
        targetType: input.targetType,
        targetId: input.targetId,
        userId: input.userId,
        reasonCode: input.reasonCode,
        note: input.note,
        createdAt: new Date(),
      })
      .onConflictDoNothing()
      .returning();
    // Konflik = laporan open yang sama sudah ada dari user ini.
    if (!row) {
      throw new ConflictError(
        'REPORT_DUPLICATE',
        'Kamu sudah melaporkan konten ini. Tim kami sedang meninjaunya.',
      );
    }
    await this.auditRepo.record({
      userId: input.userId,
      action: 'report',
      entityType: input.targetType === 'article' ? 'article' : 'article_comment',
      entityId: input.targetId,
      newData: { reason_code: input.reasonCode },
      requestId: input.requestId ?? null,
    });
    return this.toReport(row);
  }

  async list(
    status: 'open' | 'resolved' | 'dismissed' | undefined,
    cursor: string | undefined,
    limit: number,
  ): Promise<{ items: ArticleReport[]; nextCursor: string | null; hasMore: boolean }> {
    const conditions = [sql`${articleReports.userId} is not null`];
    if (status) conditions.push(eq(articleReports.status, status));
    if (cursor) conditions.push(lt(articleReports.id, cursor));
    const rows = await this.db
      .select()
      .from(articleReports)
      .where(and(...conditions))
      .orderBy(desc(articleReports.id))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: page.map((row) => this.toReport(row)),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      hasMore,
    };
  }

  async resolve(input: {
    reportId: string;
    actorId: string;
    resolution: 'dismissed' | 'taken_down';
    resolutionNote: string | null;
  }): Promise<ArticleReport> {
    const [existing] = await this.db
      .select()
      .from(articleReports)
      .where(eq(articleReports.id, input.reportId))
      .limit(1);
    if (!existing) {
      throw new NotFoundError('REPORT_NOT_FOUND', 'Laporan tidak ditemukan');
    }
    if (existing.status !== 'open') {
      throw new ConflictError('REPORT_ALREADY_RESOLVED', 'Laporan ini sudah diproses');
    }
    if (input.resolution === 'taken_down') {
      if (existing.targetType === 'article') {
        await this.articleRepo.markDeleted(existing.targetId);
      } else {
        const ok = await this.articleRepo.takedownComment(
          existing.targetId,
          input.actorId,
        );
        void ok; // komentar mungkin sudah ditakedown - laporan tetap ditutup
      }
    }
    const [row] = await this.db
      .update(articleReports)
      .set({
        status: 'resolved',
        resolution: input.resolution,
        resolutionNote: input.resolutionNote,
        resolvedBy: input.actorId,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(articleReports.id, input.reportId))
      .returning();
    await this.auditRepo.record({
      userId: input.actorId,
      action: `report:${input.resolution}`,
      entityType: 'article_report',
      entityId: input.reportId,
      newData: { resolution: input.resolution },
    });
    if (!row) {
      throw new NotFoundError('REPORT_NOT_FOUND', 'Laporan tidak ditemukan');
    }
    return this.toReport(row);
  }

  private toReport(row: typeof articleReports.$inferSelect): ArticleReport {
    return {
      id: row.id,
      targetType: row.targetType as ArticleReportTarget,
      targetId: row.targetId,
      userId: row.userId,
      username: null,
      reasonCode: row.reasonCode as ArticleReportReason,
      note: row.note,
      status: row.status as ArticleReport['status'],
      resolution: row.resolution as ArticleReport['resolution'],
      resolutionNote: row.resolutionNote,
      resolvedBy: row.resolvedBy,
      resolvedAt: row.resolvedAt,
      createdAt: row.createdAt,
    };
  }
}
