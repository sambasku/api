import { and, desc, eq, isNotNull, isNull, lt } from 'drizzle-orm';
import { meanings, users, wordReports, words } from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { ConflictError } from '@/shared/errors/app-error';
import { isUniqueViolation } from '@/shared/database/drizzle/sqlite-errors';
import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type { WordReportReasonCode } from '@/modules/word/domain/entities/word.entity';
import type {
  NewWordReport,
  WordReport,
  WordReportListFilter,
  WordReportResolution,
  WordReportStatus,
} from '../domain/entities/word-report.entity';
import type { WordReportRepository } from '../domain/repositories/word-report.repository';

type Joined = {
  report: typeof wordReports.$inferSelect;
  lemma: string | null;
  wordStatus: string | null;
  username: string | null;
  displayName: string | null;
  meaningDefinition: string | null;
};

function toEntity(row: Joined): WordReport {
  const trimmed = row.displayName?.trim() || null;
  return {
    id: row.report.id,
    wordId: row.report.wordId,
    imageId: row.report.imageId ?? null,
    meaningId: row.report.meaningId ?? null,
    meaningDefinition: row.meaningDefinition ?? null,
    wordLemma: row.lemma ?? '',
    wordStatus: row.wordStatus ?? '',
    userId: row.report.userId,
    username: row.username,
    displayName: trimmed || row.username,
    reasonCode: row.report.reasonCode as WordReportReasonCode,
    note: row.report.note,
    status: row.report.status as WordReportStatus,
    resolution: (row.report.resolution as WordReportResolution | null) ?? null,
    resolutionNote: row.report.resolutionNote,
    resolvedBy: row.report.resolvedBy,
    resolvedAt: row.report.resolvedAt,
    createdAt: row.report.createdAt,
    updatedAt: row.report.updatedAt,
  };
}

function alreadyOpenMessage(input: NewWordReport): string {
  if (input.meaningId) {
    return 'Kamu sudah melaporkan makna ini dan laporannya masih terbuka';
  }
  if (input.imageId) {
    return 'Kamu sudah melaporkan foto ini dan laporannya masih terbuka';
  }
  return 'Kamu sudah melaporkan entri ini dan laporannya masih terbuka';
}

export class WordReportRepositoryImpl implements WordReportRepository {
  constructor(private readonly db: AppDatabase) {}

  private selectJoined() {
    return this.db
      .select({
        report: wordReports,
        lemma: words.lemma,
        wordStatus: words.status,
        username: users.username,
        displayName: users.displayName,
        meaningDefinition: meanings.definition,
      })
      .from(wordReports)
      .leftJoin(words, eq(words.id, wordReports.wordId))
      .leftJoin(users, eq(users.id, wordReports.userId))
      .leftJoin(meanings, eq(meanings.id, wordReports.meaningId));
  }

  async create(input: NewWordReport): Promise<WordReport> {
    try {
      const [inserted] = await this.db
        .insert(wordReports)
        .values({
          wordId: input.wordId,
          imageId: input.imageId ?? null,
          meaningId: input.meaningId ?? null,
          userId: input.userId,
          reasonCode: input.reasonCode,
          note: input.note,
        })
        .returning({ id: wordReports.id });
      const row = await this.findById(inserted.id);
      if (!row) {
        throw new Error('word report insert tidak terbaca');
      }
      return row;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictError('WORD_REPORT_ALREADY_OPEN', alreadyOpenMessage(input));
      }
      throw err;
    }
  }

  async findOpenByUserAndWord(
    userId: string,
    wordId: string,
    opts?: { imageId?: string | null; meaningId?: string | null },
  ): Promise<WordReport | null> {
    const imageId = opts?.imageId ?? null;
    const meaningId = opts?.meaningId ?? null;
    const imageFilter =
      imageId == null ? isNull(wordReports.imageId) : eq(wordReports.imageId, imageId);
    const meaningFilter =
      meaningId == null
        ? isNull(wordReports.meaningId)
        : eq(wordReports.meaningId, meaningId);
    const [row] = await this.selectJoined()
      .where(
        and(
          eq(wordReports.userId, userId),
          eq(wordReports.wordId, wordId),
          eq(wordReports.status, 'open'),
          imageFilter,
          meaningFilter,
        ),
      )
      .limit(1);
    return row ? toEntity(row) : null;
  }

  async findById(id: string): Promise<WordReport | null> {
    const [row] = await this.selectJoined().where(eq(wordReports.id, id)).limit(1);
    return row ? toEntity(row) : null;
  }

  async list(filter: WordReportListFilter): Promise<CursorPage<WordReport>> {
    const targetFilter =
      filter.target === 'meaning'
        ? isNotNull(wordReports.meaningId)
        : filter.target === 'image'
          ? isNotNull(wordReports.imageId)
          : filter.target === 'entry'
            ? and(isNull(wordReports.imageId), isNull(wordReports.meaningId))
            : undefined;

    const rows = await this.selectJoined()
      .where(
        and(
          filter.status ? eq(wordReports.status, filter.status) : undefined,
          targetFilter,
          filter.cursor ? lt(wordReports.id, filter.cursor) : undefined,
        ),
      )
      .orderBy(desc(wordReports.id))
      .limit(filter.limit + 1);

    const hasMore = rows.length > filter.limit;
    const page = hasMore ? rows.slice(0, filter.limit) : rows;
    const items = page.map(toEntity);
    return {
      items,
      nextCursor: hasMore && items.length > 0 ? items[items.length - 1].id : null,
      hasMore,
    };
  }

  async resolveOne(input: {
    id: string;
    resolution: Exclude<WordReportResolution, 'taken_down'>;
    note: string | null;
    actorId: string;
  }): Promise<boolean> {
    const now = new Date();
    const updated = await this.db
      .update(wordReports)
      .set({
        status: 'resolved',
        resolution: input.resolution,
        resolutionNote: input.note,
        resolvedBy: input.actorId,
        resolvedAt: now,
        updatedAt: now,
      })
      .where(and(eq(wordReports.id, input.id), eq(wordReports.status, 'open')))
      .returning({ id: wordReports.id });
    return updated.length > 0;
  }

  async closeOpenForWord(wordId: string, actorId: string, note: string | null): Promise<void> {
    const now = new Date();
    await this.db
      .update(wordReports)
      .set({
        status: 'resolved',
        resolution: 'taken_down',
        resolutionNote: note,
        resolvedBy: actorId,
        resolvedAt: now,
        updatedAt: now,
      })
      .where(and(eq(wordReports.wordId, wordId), eq(wordReports.status, 'open')));
  }

  async closeOpenForMeaning(
    meaningId: string,
    actorId: string,
    note: string | null,
  ): Promise<void> {
    const now = new Date();
    await this.db
      .update(wordReports)
      .set({
        status: 'resolved',
        resolution: 'meaning_removed',
        resolutionNote: note,
        resolvedBy: actorId,
        resolvedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(wordReports.meaningId, meaningId),
          eq(wordReports.status, 'open'),
        ),
      );
  }
}
