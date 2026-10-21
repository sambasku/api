import { alias } from 'drizzle-orm/sqlite-core';
import { and, desc, eq, lt, or, sql } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { users, webImportDetails, webImports } from '@/shared/database/drizzle/schema';
import { generateId } from '@/shared/utils/ulid';
import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type {
  NewWebImport,
  WebImport,
  WebImportDetail,
  WebImportDetailOutcome,
  WebImportDetailStatus,
  WebImportStatus,
  WebImportSupportType,
} from '../domain/entities/web-import.entity';
import type {
  ListWebImportDetailsInput,
  ListWebImportDetailsResult,
  ListWebImportsInput,
  WebImportRepository,
} from '../domain/repositories/web-import.repository';

type ImportRow = typeof webImports.$inferSelect;
type DetailRow = typeof webImportDetails.$inferSelect;

const reviewerUsers = alias(users, 'web_import_reviewer');

function toSupportType(raw: string | null): WebImportSupportType | null {
  if (raw === 'web' || raw === 'book' || raw === 'article' || raw === 'other') return raw;
  return null;
}

function toImport(row: ImportRow, reviewedByName: string | null): WebImport {
  return {
    id: row.id,
    submittedBy: row.submittedBy,
    officerName: row.officerName,
    sourceLabel: row.sourceLabel,
    supportName: row.supportName,
    supportType: toSupportType(row.supportType),
    supportAddress: row.supportAddress,
    supportTitle: row.supportTitle,
    supportDesc: row.supportDesc,
    status: row.status as WebImportStatus,
    totalRows: row.totalRows,
    reviewedBy: row.reviewedBy,
    reviewedByName: reviewedByName?.trim() || null,
    reviewedAt: row.reviewedAt ?? null,
    reviewNote: row.reviewNote,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toDetail(row: DetailRow): WebImportDetail {
  return {
    id: row.id,
    importId: row.importId,
    rowNumber: row.rowNumber,
    kata: row.kata,
    terjemahan: row.terjemahan,
    penjelasanArti: row.penjelasanArti,
    type: row.type,
    contoh: row.contoh,
    artiContoh: row.artiContoh,
    status: row.status as WebImportDetailStatus,
    adminNote: row.adminNote,
    outcome: (row.outcome as WebImportDetailOutcome | null) ?? null,
    outcomeMessage: row.outcomeMessage,
    wordId: row.wordId,
    createdAt: row.createdAt,
  };
}

/** Buang wildcard LIKE agar q user tidak jadi pola liar. */
function sanitizeLike(value: string): string {
  return value.replace(/[%_]/g, '');
}

export class WebImportRepositoryImpl implements WebImportRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: NewWebImport): Promise<WebImport> {
    const details = input.details;
    await this.db.transaction(async (tx) => {
      await tx.insert(webImports).values({
        id: input.id,
        submittedBy: input.submittedBy,
        officerName: input.officerName,
        sourceLabel: input.sourceLabel,
        supportName: input.supportName,
        supportType: input.supportType,
        supportAddress: input.supportAddress,
        supportTitle: input.supportTitle,
        supportDesc: input.supportDesc,
        status: 'pending_review',
        totalRows: details.length,
      });
      if (details.length > 0) {
        await tx.insert(webImportDetails).values(
          details.map((d, index) => ({
            id: generateId(),
            importId: input.id,
            rowNumber: index + 1,
            kata: d.kata,
            terjemahan: d.terjemahan,
            penjelasanArti: d.penjelasanArti,
            type: d.type,
            contoh: d.contoh,
            artiContoh: d.artiContoh,
            status: d.status,
            adminNote: d.adminNote,
          })),
        );
      }
    });
    const found = await this.findById(input.id);
    if (!found) throw new Error('Web import hilang setelah create');
    return found;
  }

  async findById(id: string): Promise<WebImport | null> {
    const [row] = await this.db
      .select({
        imp: webImports,
        reviewedByName: reviewerUsers.displayName,
        reviewedByUsername: reviewerUsers.username,
      })
      .from(webImports)
      .leftJoin(reviewerUsers, eq(webImports.reviewedBy, reviewerUsers.id))
      .where(eq(webImports.id, id))
      .limit(1);
    if (!row) return null;
    const reviewName = row.reviewedByName ?? row.reviewedByUsername;
    return toImport(row.imp, reviewName);
  }

  async list(input: ListWebImportsInput): Promise<CursorPage<WebImport>> {
    const q = sanitizeLike(input.q?.trim() ?? '');
    const search = q
      ? or(
          sql`lower(${webImports.officerName}) like lower(${'%' + q + '%'})`,
          sql`lower(coalesce(${webImports.sourceLabel}, '')) like lower(${'%' + q + '%'})`,
          sql`lower(coalesce(${webImports.supportName}, '')) like lower(${'%' + q + '%'})`,
          sql`lower(coalesce(${webImports.supportTitle}, '')) like lower(${'%' + q + '%'})`,
        )
      : undefined;
    const conds = [];
    if (input.status) conds.push(eq(webImports.status, input.status));
    if (search) conds.push(search);
    if (input.cursor) conds.push(lt(webImports.id, input.cursor));
    const where = conds.length > 0 ? and(...conds) : undefined;

    const rows = await this.db
      .select({
        imp: webImports,
        reviewedName: reviewerUsers.displayName,
        reviewedUsername: reviewerUsers.username,
      })
      .from(webImports)
      .leftJoin(reviewerUsers, eq(webImports.reviewedBy, reviewerUsers.id))
      .where(where)
      .orderBy(desc(webImports.id))
      .limit(input.limit + 1);

    const hasMore = rows.length > input.limit;
    const page = hasMore ? rows.slice(0, input.limit) : rows;
    const items = page.map((row) => toImport(row.imp, row.reviewedName ?? row.reviewedUsername));
    return {
      items,
      nextCursor: hasMore && items.length > 0 ? items[items.length - 1].id : null,
      hasMore,
    };
  }

  async listDetails(input: ListWebImportDetailsInput): Promise<ListWebImportDetailsResult> {
    const conds = [eq(webImportDetails.importId, input.importId)];
    if (input.before !== undefined) conds.push(lt(webImportDetails.rowNumber, input.before));

    const rows = await this.db
      .select()
      .from(webImportDetails)
      .where(and(...conds))
      .orderBy(webImportDetails.rowNumber)
      .limit(input.limit + 1);

    const hasMore = rows.length > input.limit;
    const page = hasMore ? rows.slice(0, input.limit) : rows;
    const items = page.map(toDetail);
    return {
      items,
      nextCursor: hasMore && items.length > 0 ? items[items.length - 1].rowNumber : null,
      hasMore,
    };
  }

  async approve(id: string, actorId: string, note?: string | null): Promise<WebImport | null> {
    let ok = false;
    await this.db.transaction(async (tx) => {
      const rows = await tx
        .update(webImports)
        .set({
          status: 'approved',
          reviewedBy: actorId,
          reviewedAt: new Date(),
          reviewNote: note ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(webImports.id, id), eq(webImports.status, 'pending_review')))
        .returning({ id: webImports.id });
      if (rows.length === 0) return;
      await tx
        .update(webImportDetails)
        .set({ status: 'approved' })
        .where(and(eq(webImportDetails.importId, id), eq(webImportDetails.status, 'pending')));
      ok = true;
    });
    if (!ok) return null;
    return this.findById(id);
  }

  async reject(id: string, actorId: string, note: string): Promise<WebImport | null> {
    let ok = false;
    await this.db.transaction(async (tx) => {
      const rows = await tx
        .update(webImports)
        .set({
          status: 'rejected',
          reviewedBy: actorId,
          reviewedAt: new Date(),
          reviewNote: note,
          updatedAt: new Date(),
        })
        .where(and(eq(webImports.id, id), eq(webImports.status, 'pending_review')))
        .returning({ id: webImports.id });
      if (rows.length === 0) return;
      await tx
        .update(webImportDetails)
        .set({ status: 'rejected' })
        .where(and(eq(webImportDetails.importId, id), eq(webImportDetails.status, 'pending')));
      ok = true;
    });
    if (!ok) return null;
    return this.findById(id);
  }
}
