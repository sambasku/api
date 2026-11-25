import { and, desc, eq, inArray, lt } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { lemmaMergeRequests, users, words } from '@/shared/database/drizzle/schema';
import type { LemmaMergeStatus } from '@/shared/database/drizzle/schema/lemma-merge-requests.schema';
import { NotFoundError } from '@/shared/errors/app-error';

export class LemmaMergeAdminReadUseCase {
  constructor(private readonly db: AppDatabase) {}

  async list(opts: {
    status?: LemmaMergeStatus;
    limit: number;
    cursor?: string;
  }): Promise<{
    items: Array<{
      id: string;
      status: LemmaMergeStatus;
      keep_word_id: string;
      keep_lemma: string;
      merge_word_ids: string[];
      merge_count: number;
      reason_text: string | null;
      proposer_id: string;
      proposer_username: string | null;
      proposer_display_name: string;
      created_at: string;
    }>;
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    const limit = Math.min(opts.limit, 50);
    const conditions = [];
    if (opts.status) conditions.push(eq(lemmaMergeRequests.status, opts.status));
    if (opts.cursor) conditions.push(lt(lemmaMergeRequests.id, opts.cursor));

    const rows = await this.db
      .select({
        id: lemmaMergeRequests.id,
        status: lemmaMergeRequests.status,
        keepWordId: lemmaMergeRequests.keepWordId,
        mergeWordIds: lemmaMergeRequests.mergeWordIds,
        reasonText: lemmaMergeRequests.reasonText,
        createdAt: lemmaMergeRequests.createdAt,
        proposerId: lemmaMergeRequests.proposerId,
        username: users.username,
        displayName: users.displayName,
        keepLemma: words.lemma,
      })
      .from(lemmaMergeRequests)
      .innerJoin(users, eq(lemmaMergeRequests.proposerId, users.id))
      .innerJoin(words, eq(lemmaMergeRequests.keepWordId, words.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(lemmaMergeRequests.id))
      .limit(limit + 1);

    const slice = rows.slice(0, limit);
    const items = slice.map((r) => {
      const mergeIds = r.mergeWordIds ?? [];
      const display = r.displayName?.trim();
      return {
        id: r.id,
        status: r.status,
        keep_word_id: r.keepWordId,
        keep_lemma: r.keepLemma,
        merge_word_ids: mergeIds,
        merge_count: mergeIds.length,
        reason_text: r.reasonText,
        proposer_id: r.proposerId,
        proposer_username: r.username,
        proposer_display_name: display && display.length > 0 ? display : (r.username ?? '-'),
        created_at: r.createdAt.toISOString(),
      };
    });

    const hasMore = rows.length > limit;
    return {
      items,
      nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
      hasMore,
    };
  }

  async getDetail(id: string) {
    const [row] = await this.db
      .select({
        id: lemmaMergeRequests.id,
        status: lemmaMergeRequests.status,
        keepWordId: lemmaMergeRequests.keepWordId,
        mergeWordIds: lemmaMergeRequests.mergeWordIds,
        reasonText: lemmaMergeRequests.reasonText,
        reviewNote: lemmaMergeRequests.reviewNote,
        reviewedAt: lemmaMergeRequests.reviewedAt,
        createdAt: lemmaMergeRequests.createdAt,
        proposerId: lemmaMergeRequests.proposerId,
        username: users.username,
        displayName: users.displayName,
        keepLemma: words.lemma,
      })
      .from(lemmaMergeRequests)
      .innerJoin(users, eq(lemmaMergeRequests.proposerId, users.id))
      .innerJoin(words, eq(lemmaMergeRequests.keepWordId, words.id))
      .where(eq(lemmaMergeRequests.id, id))
      .limit(1);

    if (!row) {
      throw new NotFoundError('LEMMA_MERGE_NOT_FOUND', 'Usulan gabung tidak ditemukan');
    }

    const mergeIds = row.mergeWordIds ?? [];
    const mergeRows =
      mergeIds.length > 0
        ? await this.db
            .select({ id: words.id, lemma: words.lemma })
            .from(words)
            .where(inArray(words.id, mergeIds))
        : [];
    const lemmaById = new Map(mergeRows.map((w) => [w.id, w.lemma]));
    const merge_words = mergeIds.map((wordId) => ({
      word_id: wordId,
      lemma: lemmaById.get(wordId) ?? '-',
    }));

    const display = row.displayName?.trim();
    return {
      id: row.id,
      status: row.status,
      keep_word_id: row.keepWordId,
      keep_lemma: row.keepLemma,
      merge_words,
      merge_word_ids: mergeIds,
      reason_text: row.reasonText,
      review_note: row.reviewNote,
      reviewed_at: row.reviewedAt?.toISOString() ?? null,
      proposer_id: row.proposerId,
      proposer_username: row.username,
      proposer_display_name: display && display.length > 0 ? display : (row.username ?? '-'),
      created_at: row.createdAt.toISOString(),
    };
  }
}