import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import { searchDayWib } from '@/shared/database/drizzle/schema/search-daily.schema';
import { wordViews } from '@/shared/database/drizzle/schema/word-views.schema';
import { words } from '@/shared/database/drizzle/schema/words.schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type {
  WordViewReport,
  WordViewsRepository,
} from '../domain/repositories/word-views.repository';

/** 'YYYY-MM-DD' WIB dari `days` hari lalu (batas bawah inklusif). */
function dayOffset(days: number): string {
  return searchDayWib(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
}

export class WordViewsRepositoryImpl implements WordViewsRepository {
  constructor(private readonly db: AppDatabase) {}

  async recordViewById(wordId: string, viewerKey: string): Promise<void> {
    await this.db.run(sql`
      INSERT INTO word_views (word_id, day, viewer_key, count)
      SELECT id, ${searchDayWib(new Date())}, ${viewerKey}, 1
      FROM words
      WHERE id = ${wordId} AND status = 'published' AND deleted_at IS NULL
      ON CONFLICT (word_id, day, viewer_key) DO NOTHING
    `);
  }

  async recordViewByLemma(lemma: string, viewerKey: string): Promise<void> {
    const normalized = lemma.trim().toLowerCase();
    await this.db.run(sql`
      INSERT INTO word_views (word_id, day, viewer_key, count)
      SELECT id, ${searchDayWib(new Date())}, ${viewerKey}, 1
      FROM words
      WHERE id = (
        SELECT id FROM words
        WHERE lower(lemma) = ${normalized}
          AND status = 'published'
          AND deleted_at IS NULL
        ORDER BY id
        LIMIT 1
      )
      ON CONFLICT (word_id, day, viewer_key) DO NOTHING
    `);
  }

  async viewTotals(days: number | null): Promise<Map<string, number>> {
    const conds = days != null ? [gte(wordViews.day, dayOffset(days))] : [];
    const rows = await this.db
      .select({
        wordId: wordViews.wordId,
        total: sql<number>`count(*)`.mapWith(Number),
      })
      .from(wordViews)
      .where(conds.length > 0 ? and(...conds) : undefined)
      .groupBy(wordViews.wordId);
    return new Map(rows.map((r) => [r.wordId, r.total]));
  }

  async viewReport(days: number): Promise<WordViewReport> {
    const from = dayOffset(days);
    const perWordRows = await this.db
      .select({
        wordId: wordViews.wordId,
        lemma: words.lemma,
        views: sql<number>`count(*)`.mapWith(Number),
        lastViewed: sql<string>`max(${wordViews.day})`,
      })
      .from(wordViews)
      .innerJoin(words, eq(words.id, wordViews.wordId))
      .where(
        and(
          gte(wordViews.day, from),
          eq(words.status, 'published'),
          isNull(words.deletedAt),
        ),
      )
      .groupBy(wordViews.wordId)
      .orderBy(sql`count(*) desc`);
    const trendRows = await this.db
      .select({
        day: wordViews.day,
        total: sql<number>`count(*)`.mapWith(Number),
      })
      .from(wordViews)
      .where(gte(wordViews.day, from))
      .groupBy(wordViews.day)
      .orderBy(wordViews.day);
    return {
      trend: trendRows.map((r) => ({ day: r.day, total: r.total })),
      items: perWordRows.map((r) => ({
        wordId: r.wordId,
        lemma: r.lemma,
        views: r.views,
        lastViewed: r.lastViewed ?? null,
      })),
    };
  }
}
