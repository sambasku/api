import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import {
  contributions,
  meaningTranslations,
  meanings,
  searchMisses,
  votes,
  wordVariants,
  wordViews,
  words,
} from '@/shared/database/drizzle/schema';
import { searchDayWib } from '@/shared/database/drizzle/schema/search-daily.schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { feedExcludedUsageLabelClauses } from '@/shared/database/drizzle/usage-label-filters';
import type {
  HotCheckItem,
  HotProposedItem,
  HotSearchedItem,
  HotTopicTabMeta,
  HotTopicsResult,
  HotViewedItem,
} from '../domain/hot-topic.entity';
import type { HotTopicsRepository } from '../domain/hot-topics.repository';

const MS_DAY = 24 * 60 * 60 * 1000;
const WINDOW_MS = MS_DAY;
const BACKFILL_MS = 7 * MS_DAY;
/** Jumlah hari kalender WIB untuk backfill views (termasuk hari ini). */
const VIEW_BACKFILL_DAYS = 7;

/** Sembunyikan lemma berlabel seksual / diskriminatif / kasar / tabu. */
function withoutExcludedUsageLabels() {
  return feedExcludedUsageLabelClauses();
}

/** Fulfilment lemma: kata published lemma=term ATAU varian form=term. */
const lemmaFulfilledSql = sql`(
  EXISTS (
    SELECT 1 FROM ${words} w
    WHERE lower(w.lemma) = ${searchMisses.term}
      AND w.status = 'published'
      AND w.deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM ${wordVariants} v
    INNER JOIN ${words} w ON w.id = v.word_id
    WHERE lower(trim(v.form)) = ${searchMisses.term}
      AND v.deleted_at IS NULL
      AND w.status = 'published'
      AND w.deleted_at IS NULL
  )
)`;

const translationFulfilledSql = sql`EXISTS (
  SELECT 1 FROM ${meaningTranslations} mt
  INNER JOIN ${meanings} m ON m.id = mt.meaning_id AND m.deleted_at IS NULL
  INNER JOIN ${words} w ON w.id = m.word_id
  WHERE lower(trim(mt.translation_text)) = ${searchMisses.term}
    AND w.status = 'published'
    AND w.deleted_at IS NULL
    AND mt.deleted_at IS NULL
)`;

const isFulfilledSql = sql`(
  CASE
    WHEN ${searchMisses.direction} = 'translation' THEN ${translationFulfilledSql}
    ELSE ${lemmaFulfilledSql}
  END
)`;

function tabMeta(inWindow: number, total: number): HotTopicTabMeta {
  const backfilled = Math.max(0, total - inWindow);
  return {
    inWindow,
    backfilled,
    backfillUsed: backfilled > 0,
  };
}

export class HotTopicsRepositoryImpl implements HotTopicsRepository {
  constructor(private readonly db: AppDatabase) {}

  async listAllTabs(limit: number): Promise<HotTopicsResult> {
    const now = Date.now();
    const windowStart = new Date(now - WINDOW_MS);
    const backfillStart = new Date(now - BACKFILL_MS);

    const [searched, proposed, viewed, check] = await Promise.all([
      this.listSearched(limit, windowStart, backfillStart),
      this.listProposed(limit, windowStart, backfillStart),
      this.listViewed(limit),
      this.listCheck(limit, windowStart, backfillStart),
    ]);

    return { searched, proposed, viewed, check };
  }

  private async listSearched(
    limit: number,
    windowStart: Date,
    backfillStart: Date,
  ): Promise<{ items: HotSearchedItem[]; meta: HotTopicTabMeta }> {
    // Ambil kandidat 7 hari; potong window dulu lalu backfill tanpa duplikat.
    const rows = await this.db
      .select({
        id: searchMisses.id,
        term: searchMisses.term,
        direction: searchMisses.direction,
        hitCount: searchMisses.hitCount,
        lastSearchedAt: searchMisses.lastSearchedAt,
      })
      .from(searchMisses)
      .where(
        and(
          eq(searchMisses.isVisible, true),
          isNull(searchMisses.deletedAt),
          gte(searchMisses.lastSearchedAt, backfillStart),
          sql`NOT ${isFulfilledSql}`,
          // Sembunyikan miss yang masih punya usulan pending (sama feed).
          sql`NOT EXISTS (
            SELECT 1 FROM ${contributions} c
            WHERE c.search_miss_id = ${searchMisses.id}
              AND c.status = 'pending'
              AND c.deleted_at IS NULL
          )`,
        ),
      )
      .orderBy(desc(searchMisses.lastSearchedAt), desc(searchMisses.hitCount))
      .limit(limit * 3);

    const windowItems: HotSearchedItem[] = [];
    const backfillItems: HotSearchedItem[] = [];
    for (const r of rows) {
      const last = r.lastSearchedAt;
      const inWindow = last.getTime() >= windowStart.getTime();
      const item: HotSearchedItem = {
        kind: 'search_miss',
        id: r.id,
        term: r.term,
        direction: r.direction === 'translation' ? 'translation' : 'lemma',
        hitCount: r.hitCount,
        lastSearchedAt: last,
        inWindow,
      };
      if (inWindow) windowItems.push(item);
      else backfillItems.push(item);
    }

    // Pool oversized: use case saring blocklist lalu potong ke `limit`.
    const items = [...windowItems, ...backfillItems];
    const inWindowCount = items.filter((i) => i.inWindow).length;
    return { items, meta: tabMeta(inWindowCount, items.length) };
  }

  private async listProposed(
    limit: number,
    windowStart: Date,
    backfillStart: Date,
  ): Promise<{ items: HotProposedItem[]; meta: HotTopicTabMeta }> {
    const rows = await this.db
      .select({
        id: contributions.id,
        wordId: contributions.entityId,
        lemma: words.lemma,
        createdAt: contributions.createdAt,
      })
      .from(contributions)
      .innerJoin(words, eq(words.id, contributions.entityId))
      .where(
        and(
          eq(contributions.entityType, 'word'),
          eq(contributions.status, 'pending'),
          // Hanya kata yang sudah tayang (published, boleh belum verified).
          // pending_review (usulan tamu) tidak ikut - publik GET /words/:id 404.
          eq(words.status, 'published'),
          isNull(contributions.deletedAt),
          isNull(words.deletedAt),
          gte(contributions.createdAt, backfillStart),
          ...withoutExcludedUsageLabels(),
        ),
      )
      .orderBy(desc(contributions.createdAt), desc(contributions.id))
      .limit(limit * 3);

    const windowItems: HotProposedItem[] = [];
    const backfillItems: HotProposedItem[] = [];
    for (const r of rows) {
      const created = r.createdAt;
      const inWindow = created.getTime() >= windowStart.getTime();
      const item: HotProposedItem = {
        kind: 'contribution',
        id: r.id,
        wordId: r.wordId,
        lemma: r.lemma,
        createdAt: created,
        inWindow,
      };
      if (inWindow) windowItems.push(item);
      else backfillItems.push(item);
    }

    // Pool oversized: use case saring blocklist lalu potong ke `limit`.
    const items = [...windowItems, ...backfillItems];
    const inWindowCount = items.filter((i) => i.inWindow).length;
    return { items, meta: tabMeta(inWindowCount, items.length) };
  }

  /**
   * Top lemma by unique viewers.
   * Jendela ≈ 24 jam: **hari WIB ini + kemarin** (data `word_views` hanya
   * granularitas hari, bukan rolling wall-clock). Kalau slot kurang dari
   * limit, isi sisa dari agregat 7 hari kalender WIB (tanpa duplikat).
   */
  private async listViewed(
    limit: number,
  ): Promise<{ items: HotViewedItem[]; meta: HotTopicTabMeta }> {
    const today = searchDayWib(new Date());
    const yesterday = searchDayWib(new Date(Date.now() - MS_DAY));
    const from = searchDayWib(
      new Date(Date.now() - (VIEW_BACKFILL_DAYS - 1) * MS_DAY),
    );
    // Jendela = hari ini + kemarin WIB (perkiraan 24 jam tanpa timestamp).
    const windowViewsExpr = sql<number>`coalesce(sum(case when ${wordViews.day} in (${today}, ${yesterday}) then 1 else 0 end), 0)`.mapWith(
      Number,
    );
    const viewsExpr = sql<number>`count(*)`.mapWith(Number);
    const lastDayExpr = sql<string>`max(${wordViews.day})`;

    const rows = await this.db
      .select({
        wordId: wordViews.wordId,
        lemma: words.lemma,
        windowViews: windowViewsExpr,
        views: viewsExpr,
        lastViewedDay: lastDayExpr,
      })
      .from(wordViews)
      .innerJoin(words, eq(words.id, wordViews.wordId))
      .where(
        and(
          gte(wordViews.day, from),
          eq(words.status, 'published'),
          isNull(words.deletedAt),
          ...withoutExcludedUsageLabels(),
        ),
      )
      .groupBy(wordViews.wordId, words.lemma)
      .orderBy(sql`${windowViewsExpr} desc`, sql`${viewsExpr} desc`, words.lemma)
      .limit(limit * 3);

    const windowItems: HotViewedItem[] = [];
    const backfillItems: HotViewedItem[] = [];
    for (const r of rows) {
      const inWindow = r.windowViews > 0;
      const item: HotViewedItem = {
        kind: 'word_view',
        wordId: r.wordId,
        lemma: r.lemma,
        // Window: total hari ini+kemarin; backfill: total 7 hari.
        viewCount: inWindow ? r.windowViews : r.views,
        lastViewedDay: r.lastViewedDay,
        inWindow,
      };
      if (inWindow) windowItems.push(item);
      else backfillItems.push(item);
    }

    // Pool oversized: use case saring blocklist lalu potong ke `limit`.
    const items = [...windowItems, ...backfillItems];
    const inWindowCount = items.filter((i) => i.inWindow).length;
    return { items, meta: tabMeta(inWindowCount, items.length) };
  }

  /**
   * Chip Cek: makna published dengan downvote aktif (votes.value = -1).
   * Jendela 24 jam wall-clock + backfill 7 hari (tanpa duplikat).
   * Kolom votes.*At = unix detik (drizzle mode timestamp).
   */
  private async listCheck(
    limit: number,
    windowStart: Date,
    backfillStart: Date,
  ): Promise<{ items: HotCheckItem[]; meta: HotTopicTabMeta }> {
    const downExpr = sql<number>`count(*)`.mapWith(Number);
    const lastDownSecExpr = sql<number>`max(coalesce(${votes.updatedAt}, ${votes.createdAt}))`.mapWith(
      Number,
    );
    const backfillSec = Math.floor(backfillStart.getTime() / 1000);

    const rows = await this.db
      .select({
        meaningId: votes.entityId,
        wordId: meanings.wordId,
        lemma: words.lemma,
        definition: meanings.definition,
        downvotes: downExpr,
        lastDownSec: lastDownSecExpr,
      })
      .from(votes)
      .innerJoin(meanings, eq(meanings.id, votes.entityId))
      .innerJoin(words, eq(words.id, meanings.wordId))
      .where(
        and(
          eq(votes.entityType, 'meaning'),
          eq(votes.value, -1),
          eq(meanings.status, 'published'),
          isNull(meanings.deletedAt),
          eq(words.status, 'published'),
          isNull(words.deletedAt),
          ...withoutExcludedUsageLabels(),
        ),
      )
      .groupBy(
        votes.entityId,
        meanings.wordId,
        words.lemma,
        meanings.definition,
      )
      .having(sql`${lastDownSecExpr} >= ${backfillSec}`)
      .orderBy(sql`${lastDownSecExpr} desc`, sql`${downExpr} desc`)
      .limit(limit * 3);

    const windowItems: HotCheckItem[] = [];
    const backfillItems: HotCheckItem[] = [];
    for (const r of rows) {
      const last = new Date(r.lastDownSec * 1000);
      const inWindow = last.getTime() >= windowStart.getTime();
      const item: HotCheckItem = {
        kind: 'meaning_downvote',
        meaningId: r.meaningId,
        wordId: r.wordId,
        lemma: r.lemma,
        definitionPreview: r.definition?.trim()
          ? r.definition.trim().slice(0, 120)
          : null,
        downvotes: r.downvotes,
        lastDownvotedAt: last,
        inWindow,
      };
      if (inWindow) windowItems.push(item);
      else backfillItems.push(item);
    }

    const items = [...windowItems, ...backfillItems];
    const inWindowCount = items.filter((i) => i.inWindow).length;
    return { items, meta: tabMeta(inWindowCount, items.length) };
  }
}
