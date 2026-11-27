import { and, desc, eq, gte, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import {
  comments,
  contributions,
  hotViewedSlots,
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
  HotCommentedItem,
  HotProposedItem,
  HotSearchedItem,
  HotTopicTabMeta,
  HotTopicsResult,
  HotVerifiedItem,
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

  async listAllTabs(limit: number, nowDate?: Date): Promise<HotTopicsResult> {
    const now = nowDate ? nowDate.getTime() : Date.now();
    const windowStart = new Date(now - WINDOW_MS);
    const backfillStart = new Date(now - BACKFILL_MS);

    const [searched, proposed, viewed, check, verified, commented] = await Promise.all([
      this.listSearched(limit, windowStart, backfillStart),
      this.listProposed(limit, windowStart, backfillStart),
      this.listViewed(limit, now, true),
      this.listCheck(limit, windowStart, backfillStart),
      this.listVerified(limit, windowStart),
      this.listCommented(limit, windowStart, backfillStart),
    ]);

    return { searched, proposed, viewed, check, verified, commented };
  }

  async listActiveViewedCandidates(
    limit: number,
    nowDate?: Date,
  ): Promise<{ items: HotViewedItem[]; meta: HotTopicTabMeta }> {
    const now = nowDate ? nowDate.getTime() : Date.now();
    return this.listViewed(limit, now, false);
  }

  async pruneExpiredViewedSlots(now: Date): Promise<number> {
    const deleted = await this.db
      .delete(hotViewedSlots)
      .where(lte(hotViewedSlots.cooldownUntil, now))
      .returning({ wordId: hotViewedSlots.wordId });
    return deleted.length;
  }

  async recordViewedSlotEntries(
    wordIds: string[],
    opts: { enteredAt: Date; expiresAt: Date; cooldownUntil: Date },
  ): Promise<number> {
    if (wordIds.length === 0) return 0;
    const uniqueIds = [...new Set(wordIds)];
    const inserted = await this.db
      .insert(hotViewedSlots)
      .values(
        uniqueIds.map((wordId) => ({
          wordId,
          enteredAt: opts.enteredAt,
          expiresAt: opts.expiresAt,
          cooldownUntil: opts.cooldownUntil,
          updatedAt: opts.enteredAt,
        })),
      )
      .onConflictDoNothing({ target: hotViewedSlots.wordId })
      .returning({ wordId: hotViewedSlots.wordId });
    return inserted.length;
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
          // Usulan tamu sekarang published + unverified - ikut tab Usulan.
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
   * Jendela ~24 jam: **hari WIB ini + kemarin** (data `word_views` hanya
   * granularitas hari, bukan rolling wall-clock). Kalau slot kurang dari
   * limit, isi sisa dari agregat 7 hari kalender WIB (tanpa duplikat).
   *
   * #372: LEFT JOIN `hot_viewed_slots` - kata yang sudah melewati masa tayang
   * 24 jam (`now >= expires_at`) dan masih dalam masa cooldown (`now < cooldown_until`)
   * diturunkan ke bucket fallback (hanya dipakai jika kandidat non-cooldown < limit).
   */
  private async listViewed(
    limit: number,
    nowMs: number,
    includeCooldownFallback: boolean,
  ): Promise<{ items: HotViewedItem[]; meta: HotTopicTabMeta }> {
    const today = searchDayWib(new Date(nowMs));
    const yesterday = searchDayWib(new Date(nowMs - MS_DAY));
    const from = searchDayWib(
      new Date(nowMs - (VIEW_BACKFILL_DAYS - 1) * MS_DAY),
    );
    const nowSec = Math.floor(nowMs / 1000);
    // Jendela = hari ini + kemarin WIB (perkiraan 24 jam tanpa timestamp).
    const windowViewsExpr = sql<number>`coalesce(sum(case when ${wordViews.day} in (${today}, ${yesterday}) then 1 else 0 end), 0)`.mapWith(
      Number,
    );
    const viewsExpr = sql<number>`count(*)`.mapWith(Number);
    const lastDayExpr = sql<string>`max(${wordViews.day})`;
    const isCooldownExpr = sql<number>`case when ${hotViewedSlots.wordId} is not null and ${nowSec} >= ${hotViewedSlots.expiresAt} and ${nowSec} < ${hotViewedSlots.cooldownUntil} then 1 else 0 end`.mapWith(
      Number,
    );

    const rows = await this.db
      .select({
        wordId: wordViews.wordId,
        lemma: words.lemma,
        windowViews: windowViewsExpr,
        views: viewsExpr,
        lastViewedDay: lastDayExpr,
        isCooldown: isCooldownExpr,
      })
      .from(wordViews)
      .innerJoin(words, eq(words.id, wordViews.wordId))
      .leftJoin(hotViewedSlots, eq(hotViewedSlots.wordId, wordViews.wordId))
      .where(
        and(
          gte(wordViews.day, from),
          eq(words.status, 'published'),
          isNull(words.deletedAt),
          ...withoutExcludedUsageLabels(),
        ),
      )
      .groupBy(
        wordViews.wordId,
        words.lemma,
        hotViewedSlots.wordId,
        hotViewedSlots.expiresAt,
        hotViewedSlots.cooldownUntil,
      )
      .orderBy(
        sql`${isCooldownExpr} asc`,
        sql`${windowViewsExpr} desc`,
        sql`${viewsExpr} desc`,
        words.lemma,
      )
      .limit(limit * 3);

    const windowItems: HotViewedItem[] = [];
    const backfillItems: HotViewedItem[] = [];
    const cooldownFallbackItems: HotViewedItem[] = [];
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
      if (r.isCooldown === 1) {
        if (includeCooldownFallback) cooldownFallbackItems.push(item);
      } else if (inWindow) {
        windowItems.push(item);
      } else {
        backfillItems.push(item);
      }
    }

    // Pool oversized: use case saring blocklist lalu potong ke `limit`.
    const items = [...windowItems, ...backfillItems, ...cooldownFallbackItems];
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

  /**
   * Chip Verif: lemma published yang baru diverifikasi.
   * Satu query, tanpa filter jendela keras (urut verified_at DESC, id DESC);
   * `inWindow` = verified dalam 24 jam terakhir.
   */
  private async listVerified(
    limit: number,
    windowStart: Date,
  ): Promise<{ items: HotVerifiedItem[]; meta: HotTopicTabMeta }> {
    const rows = await this.db
      .select({
        wordId: words.id,
        lemma: words.lemma,
        verifiedAt: words.verifiedAt,
      })
      .from(words)
      .where(
        and(
          eq(words.status, 'published'),
          isNull(words.deletedAt),
          isNotNull(words.verifiedAt),
          ...withoutExcludedUsageLabels(),
        ),
      )
      .orderBy(desc(words.verifiedAt), desc(words.id))
      .limit(limit * 3);

    // Pool oversized: use case saring blocklist lalu potong ke `limit`.
    const items: HotVerifiedItem[] = [];
    for (const r of rows) {
      if (!r.verifiedAt) continue;
      items.push({
        kind: 'word_verified',
        wordId: r.wordId,
        lemma: r.lemma,
        verifiedAt: r.verifiedAt,
        inWindow: r.verifiedAt.getTime() >= windowStart.getTime(),
      });
    }
    const inWindowCount = items.filter((i) => i.inWindow).length;
    return { items, meta: tabMeta(inWindowCount, items.length) };
  }

  /**
   * Chip Komen: lemma dengan komentar published terbaru.
   * Satu agregat di `comments` (JOIN words), kandidat 7 hari terakhir;
   * `commentCount` = jumlah komentar published dalam 7 hari itu,
   * `lastCommentedAt` = max(created_at). `inWindow` = komentar terakhir
   * dalam 24 jam. Kolom comments.created_at = unix detik.
   */
  private async listCommented(
    limit: number,
    windowStart: Date,
    backfillStart: Date,
  ): Promise<{ items: HotCommentedItem[]; meta: HotTopicTabMeta }> {
    const countExpr = sql<number>`count(*)`.mapWith(Number);
    const lastSecExpr = sql<number>`max(${comments.createdAt})`.mapWith(Number);

    const rows = await this.db
      .select({
        wordId: comments.wordId,
        lemma: words.lemma,
        commentCount: countExpr,
        lastSec: lastSecExpr,
      })
      .from(comments)
      .innerJoin(words, eq(words.id, comments.wordId))
      .where(
        and(
          eq(comments.status, 'published'),
          isNull(comments.deletedAt),
          gte(comments.createdAt, backfillStart),
          eq(words.status, 'published'),
          isNull(words.deletedAt),
          ...withoutExcludedUsageLabels(),
        ),
      )
      .groupBy(comments.wordId, words.lemma)
      .orderBy(sql`${lastSecExpr} desc`, sql`${countExpr} desc`)
      .limit(limit * 3);

    // Pool oversized: use case saring blocklist lalu potong ke `limit`.
    const items: HotCommentedItem[] = rows.map((r) => {
      const last = new Date(r.lastSec * 1000);
      return {
        kind: 'word_commented',
        wordId: r.wordId,
        lemma: r.lemma,
        commentCount: r.commentCount,
        lastCommentedAt: last,
        inWindow: last.getTime() >= windowStart.getTime(),
      };
    });
    const inWindowCount = items.filter((i) => i.inWindow).length;
    return { items, meta: tabMeta(inWindowCount, items.length) };
  }
}
