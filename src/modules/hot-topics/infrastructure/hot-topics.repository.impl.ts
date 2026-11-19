import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import {
  contributions,
  meaningTranslations,
  meanings,
  searchMisses,
  votes,
  wordVariants,
  words,
} from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import {
  VOTING_WARGA_NET_THRESHOLD,
} from '@/shared/constants/voting-warga';
import type {
  HotNearThresholdItem,
  HotProposedItem,
  HotSearchedItem,
  HotTopicTabMeta,
  HotTopicsResult,
} from '../domain/hot-topic.entity';
import type { HotTopicsRepository } from '../domain/hot-topics.repository';

const MS_DAY = 24 * 60 * 60 * 1000;
const WINDOW_MS = MS_DAY;
const BACKFILL_MS = 7 * MS_DAY;

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

    const [searched, proposed, nearThreshold] = await Promise.all([
      this.listSearched(limit, windowStart, backfillStart),
      this.listProposed(limit, windowStart, backfillStart),
      this.listNearThreshold(limit, windowStart, backfillStart),
    ]);

    return { searched, proposed, nearThreshold };
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

    const items = [...windowItems, ...backfillItems].slice(0, limit);
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
          isNull(contributions.deletedAt),
          isNull(words.deletedAt),
          gte(contributions.createdAt, backfillStart),
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

    const items = [...windowItems, ...backfillItems].slice(0, limit);
    const inWindowCount = items.filter((i) => i.inWindow).length;
    return { items, meta: tabMeta(inWindowCount, items.length) };
  }

  private async listNearThreshold(
    limit: number,
    windowStart: Date,
    backfillStart: Date,
  ): Promise<{ items: HotNearThresholdItem[]; meta: HotTopicTabMeta }> {
    const netExpr = sql<number>`coalesce(sum(${votes.value}), 0)`.mapWith(Number);
    const upExpr = sql<number>`coalesce(sum(case when ${votes.value} = 1 then 1 else 0 end), 0)`.mapWith(
      Number,
    );
    const downExpr = sql<number>`coalesce(sum(case when ${votes.value} = -1 then 1 else 0 end), 0)`.mapWith(
      Number,
    );
    const lastVoteMsExpr = sql<number>`max(coalesce(${votes.updatedAt}, ${votes.createdAt}))`.mapWith(
      Number,
    );

    // Net mendekati ambang Voting Warga (±5) tapi belum sampai / belum verified.
    const threshold = VOTING_WARGA_NET_THRESHOLD;
    const rows = await this.db
      .select({
        meaningId: votes.entityId,
        wordId: meanings.wordId,
        lemma: words.lemma,
        definition: meanings.definition,
        net: netExpr,
        upvotes: upExpr,
        downvotes: downExpr,
        lastVoteMs: lastVoteMsExpr,
      })
      .from(votes)
      .innerJoin(meanings, eq(meanings.id, votes.entityId))
      .innerJoin(words, eq(words.id, meanings.wordId))
      .where(
        and(
          eq(votes.entityType, 'meaning'),
          eq(meanings.status, 'published'),
          isNull(meanings.deletedAt),
          eq(meanings.isVerified, false),
          isNull(words.deletedAt),
          eq(words.status, 'published'),
        ),
      )
      .groupBy(
        votes.entityId,
        meanings.wordId,
        words.lemma,
        meanings.definition,
      )
      .having(
        and(
          sql`abs(${netExpr}) >= 2`,
          sql`abs(${netExpr}) < ${threshold}`,
          sql`${lastVoteMsExpr} >= ${backfillStart.getTime()}`,
        ),
      )
      .orderBy(sql`abs(${netExpr}) desc`, desc(netExpr))
      .limit(limit * 3);

    const windowItems: HotNearThresholdItem[] = [];
    const backfillItems: HotNearThresholdItem[] = [];
    for (const r of rows) {
      const last = new Date(r.lastVoteMs);
      const inWindow = last.getTime() >= windowStart.getTime();
      const item: HotNearThresholdItem = {
        kind: 'meaning_vote',
        meaningId: r.meaningId,
        wordId: r.wordId,
        lemma: r.lemma,
        definitionPreview: r.definition?.trim() ? r.definition.trim().slice(0, 120) : null,
        net: r.net,
        upvotes: r.upvotes,
        downvotes: r.downvotes,
        inWindow,
      };
      if (inWindow) windowItems.push(item);
      else backfillItems.push(item);
    }

    const items = [...windowItems, ...backfillItems].slice(0, limit);
    const inWindowCount = items.filter((i) => i.inWindow).length;
    return { items, meta: tabMeta(inWindowCount, items.length) };
  }
}
