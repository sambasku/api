import { and, asc, desc, eq, inArray, isNull, lt, ne, notExists, or, sql } from 'drizzle-orm';
import {
  comments,
  examples,
  languages,
  meanings,
  meaningTranslations,
  pronunciations,
  discussionReplies,
  discussions,
  users,
  userSkips,
  votes,
  wordImages,
  meaningVoteCounts,
  words,
} from '@/shared/database/drizzle/schema';
import type { AppDatabase, AppTransaction } from '@/shared/database/drizzle/client';
import { ilikeCompat } from '@/shared/database/drizzle/ilike-compat';
import { FEED_EXCLUDED_USAGE_LABELS } from '@/shared/constants/usage-labels';
import { NotFoundError } from '@/shared/errors/app-error';
import { seededShuffle } from '@/shared/utils/seeded-shuffle';
import type {
  AdminVoteCursor,
  AdminVoteListFilter,
  AdminVoteListResult,
  AdminVoteListItem,
  AdminTopVoteTarget,
  ToggleVoteResult,
  VoteCounts,
  VoteDeckListOptions,
  VoteDeckListResult,
  VoteDeckMeaning,
  VoteHistoryItem,
  VoteHistoryListOptions,
  VoteHistoryListResult,
  VoteHistoryWord,
  VoteRepository,
  VoteTarget,
  VoteTargetType,
} from '../domain/repositories/vote.repository';
import { encodeAdminCursor, encodeVoteDeckCursor } from '../domain/repositories/vote.repository';

export const voteTargetKey = (t: VoteTarget): string => `${t.entityType}:${t.entityId}`;

const PREVIEW_MAX = 120;

function clipPreview(s: string): string {
  const t = s.trim().replace(/\s+/g, ' ');
  if (t.length <= PREVIEW_MAX) return t;
  return `${t.slice(0, PREVIEW_MAX - 1)}…`;
}

export class VoteRepositoryImpl implements VoteRepository {
  constructor(private readonly db: AppDatabase) {}

  async targetExists(target: VoteTarget): Promise<boolean> {
    // Lima blok serupa, bukan satu helper generik: akses kolom per tabel
    // secara structural lebih mudah dibaca (dan type-safe) daripada
    // berkelahi dengan generics Drizzle lintas tabel.
    switch (target.entityType) {
      case 'word': {
        const rows = await this.db
          .select({ id: words.id })
          .from(words)
          .where(and(eq(words.id, target.entityId), isNull(words.deletedAt)))
          .limit(1);
        return rows.length > 0;
      }
      case 'meaning': {
        // Hanya makna published yang belum dihapus. Status kata induk tidak
        // ikut dicek di sini: endpoint counts/deck sudah memfilter, dan
        // jalur tulis cukup menolak target mati (404). Tambah cek kata bisa
        // memblokir vote sah saat status kata masih draft sementara makna
        // sudah published (jalur kontribusi).
        const rows = await this.db
          .select({ id: meanings.id })
          .from(meanings)
          .where(
            and(
              eq(meanings.id, target.entityId),
              isNull(meanings.deletedAt),
              eq(meanings.status, 'published'),
            ),
          )
          .limit(1);
        return rows.length > 0;
      }
      case 'example': {
        const rows = await this.db
          .select({ id: examples.id })
          .from(examples)
          .where(and(eq(examples.id, target.entityId), isNull(examples.deletedAt)))
          .limit(1);
        return rows.length > 0;
      }
      case 'pronunciation': {
        const rows = await this.db
          .select({ id: pronunciations.id })
          .from(pronunciations)
          .where(and(eq(pronunciations.id, target.entityId), isNull(pronunciations.deletedAt)))
          .limit(1);
        return rows.length > 0;
      }
      case 'word_image': {
        const rows = await this.db
          .select({ id: wordImages.id })
          .from(wordImages)
          .where(and(eq(wordImages.id, target.entityId), isNull(wordImages.deletedAt)))
          .limit(1);
        return rows.length > 0;
      }
      case 'comment': {
        const rows = await this.db
          .select({ id: comments.id })
          .from(comments)
          .where(and(eq(comments.id, target.entityId), isNull(comments.deletedAt)))
          .limit(1);
        return rows.length > 0;
      }
      case 'discussion_reply': {
        // Hanya balasan tayang yang boleh di-vote (taken_down /
        // deleted_by_author → 404 VOTE_TARGET_NOT_FOUND).
        const rows = await this.db
          .select({ id: discussionReplies.id })
          .from(discussionReplies)
          .where(
            and(
              eq(discussionReplies.id, target.entityId),
              eq(discussionReplies.status, 'published'),
            ),
          )
          .limit(1);
        return rows.length > 0;
      }
      case 'discussion': {
        const rows = await this.db
          .select({ id: discussions.id })
          .from(discussions)
          .where(
            and(eq(discussions.id, target.entityId), eq(discussions.status, 'published')),
          )
          .limit(1);
        return rows.length > 0;
      }
    }
  }

  async toggle(
    userId: string,
    target: VoteTarget,
    value: 1 | -1,
    clientId?: string | null,
  ): Promise<ToggleVoteResult> {
    return this.db.transaction(async (tx) => {
      // Vote searah kedua kali = batal. Hanya hapus baris dengan arah yang
      // SAMA - kalau tidak kena berarti baru / beda arah → upsert di bawah.
      const removed = await tx
        .delete(votes)
        .where(
          and(
            eq(votes.userId, userId),
            eq(votes.entityType, target.entityType),
            eq(votes.entityId, target.entityId),
            eq(votes.value, value),
          ),
        )
        .returning({ id: votes.id });

      let myVote: 1 | -1 | null = null;
      if (removed.length === 0) {
        // 0085: tahu apakah upsert ini = baris BARU (+1 ringkasan) atau
        // ganti arah baris lama (+0) - cek existence sebelum insert.
        const [existing] = await tx
          .select({ id: votes.id })
          .from(votes)
          .where(
            and(
              eq(votes.userId, userId),
              eq(votes.entityType, target.entityType),
              eq(votes.entityId, target.entityId),
            ),
          )
          .limit(1);
        await tx
          .insert(votes)
          .values({
            userId,
            entityType: target.entityType,
            entityId: target.entityId,
            value,
            clientId: clientId ?? null,
          })
          .onConflictDoUpdate({
            target: [votes.userId, votes.entityType, votes.entityId],
            set: {
              value,
              clientId: clientId ?? null,
              updatedAt: new Date(),
            },
          });
        myVote = value;

        // 0101: ringkasan deck - hanya vote makna yang punya baris di
        // meaning_vote_counts; insert baru = +1, ganti arah = net 0.
        if (target.entityType === 'meaning' && !existing) {
          await this.bumpMeaningVoteCount(tx, target.entityId, 1);
        }
      } else if (target.entityType === 'meaning') {
        // batal vote = baris hilang.
        await this.bumpMeaningVoteCount(tx, target.entityId, -1);
      }

      const [row] = await tx
        .select({
          upvotes: sql<number>`sum(case when ${votes.value} = 1 then 1 else 0 end)`.mapWith(Number),
          downvotes: sql<number>`sum(case when ${votes.value} = -1 then 1 else 0 end)`.mapWith(Number),
        })
        .from(votes)
        .where(and(eq(votes.entityType, target.entityType), eq(votes.entityId, target.entityId)));

      return { myVote, upvotes: row?.upvotes ?? 0, downvotes: row?.downvotes ?? 0 };
    });
  }

  /**
   * Naik/turunkan `meaning_vote_counts.total` di transaksi yang sama dengan
   * tulis vote. `delta` = perubahan JUMLAH baris vote makna itu.
   */
  private async bumpMeaningVoteCount(
    tx: AppTransaction,
    meaningId: string,
    delta: number,
  ): Promise<void> {
    await tx
      .insert(meaningVoteCounts)
      .values({ meaningId, total: Math.max(delta, 0), updatedAt: new Date() })
      .onConflictDoUpdate({
        target: meaningVoteCounts.meaningId,
        set: {
          // Clamp di 0: penurunan ganda (race admin reset + unvote, atau
          // baris yatim pasca-backfill) tidak boleh membuat total negatif -
          // deck mengurutkan total ASC, nilai negatif akan menyandera kartu
          // di depan antrean selamanya.
          total: sql`max(0, ${meaningVoteCounts.total} + ${delta})`,
          updatedAt: new Date(),
        },
      });
  }

  async countMany(targets: VoteTarget[]): Promise<Map<string, VoteCounts>> {
    const result = new Map<string, VoteCounts>();
    if (targets.length === 0) return result;

    const rows = await this.db
      .select({
        entityType: votes.entityType,
        entityId: votes.entityId,
        upvotes: sql<number>`sum(case when ${votes.value} = 1 then 1 else 0 end)`.mapWith(Number),
        downvotes: sql<number>`sum(case when ${votes.value} = -1 then 1 else 0 end)`.mapWith(Number),
      })
      .from(votes)
      .where(
        or(
          ...targets.map((t) =>
            and(eq(votes.entityType, t.entityType), eq(votes.entityId, t.entityId)),
          ),
        ),
      )
      .groupBy(votes.entityType, votes.entityId);

    for (const row of rows) {
      result.set(`${row.entityType}:${row.entityId}`, {
        upvotes: row.upvotes,
        downvotes: row.downvotes,
      });
    }
    return result;
  }

  async findUserVotes(userId: string, targets: VoteTarget[]): Promise<Map<string, 1 | -1>> {
    const result = new Map<string, 1 | -1>();
    if (targets.length === 0) return result;

    const rows = await this.db
      .select({ entityType: votes.entityType, entityId: votes.entityId, value: votes.value })
      .from(votes)
      .where(
        and(
          eq(votes.userId, userId),
          or(
            ...targets.map((t) =>
              and(eq(votes.entityType, t.entityType), eq(votes.entityId, t.entityId)),
            ),
          ),
        ),
      );

    for (const row of rows) {
      result.set(`${row.entityType}:${row.entityId}`, row.value === 1 ? 1 : -1);
    }
    return result;
  }

  async listAdmin(
    filter: AdminVoteListFilter,
    limit: number,
    cursor: AdminVoteCursor | null,
  ): Promise<AdminVoteListResult> {
    const rows = await this.db
      .select({
        id: votes.id,
        userId: votes.userId,
        voterUsername: users.username,
        voterDisplayName: users.displayName,
        voterAvatarUrl: users.avatarUrl,
        voterEmail: users.email,
        entityType: votes.entityType,
        entityId: votes.entityId,
        value: votes.value,
        clientId: votes.clientId,
        createdAt: votes.createdAt,
        updatedAt: votes.updatedAt,
      })
      .from(votes)
      .innerJoin(users, eq(users.id, votes.userId))
      .where(
        and(
          isNull(users.deletedAt),
          filter.entityType ? eq(votes.entityType, filter.entityType) : undefined,
          filter.value !== undefined ? eq(votes.value, filter.value) : undefined,
          filter.targetId ? eq(votes.entityId, filter.targetId) : undefined,
          filter.q
            ? or(
                ilikeCompat(users.username, `%${filter.q}%`),
                ilikeCompat(users.email, `%${filter.q}%`),
              )
            : undefined,
          cursor
            ? lt(sql`(${votes.createdAt}, ${votes.id})`, sql`(${cursor.createdAt}, ${cursor.id})`)
            : undefined,
        ),
      )
      .orderBy(desc(votes.createdAt), desc(votes.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor: string | null = last && hasMore ? encodeAdminCursor({ createdAt: last.createdAt, id: last.id }) : null;

    const items: AdminVoteListItem[] = page.map((row) => ({
      id: row.id,
      userId: row.userId,
      voterUsername: row.voterUsername,
      voterDisplayName: row.voterDisplayName,
      voterAvatarUrl: row.voterAvatarUrl,
      voterEmail: row.voterEmail,
      entityType: row.entityType as VoteTargetType,
      entityId: row.entityId,
      value: row.value === 1 ? 1 : -1,
      clientId: row.clientId ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      targetPreview: null,
    }));

    const previewMap = await this.resolveTargetPreviews(
      items.map((i) => ({ entityType: i.entityType, entityId: i.entityId })),
    );
    for (const item of items) {
      item.targetPreview = previewMap.get(voteTargetKey(item)) ?? null;
    }

    return {
      items,
      meta: { limit, nextCursor, hasMore },
    };
  }

  async deleteById(id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select({ entityType: votes.entityType, entityId: votes.entityId })
        .from(votes)
        .where(eq(votes.id, id))
        .limit(1);
      if (!row) throw new NotFoundError('VOTE_NOT_FOUND', 'Vote tidak ditemukan');
      await tx.delete(votes).where(eq(votes.id, id));
      if (row.entityType === 'meaning') {
        await this.bumpMeaningVoteCount(tx, row.entityId, -1);
      }
    });
  }

  async resetTarget(target: VoteTarget): Promise<number> {
    return this.db.transaction(async (tx) => {
      const removed = await tx
        .delete(votes)
        .where(and(eq(votes.entityType, target.entityType), eq(votes.entityId, target.entityId)))
        .returning({ id: votes.id });
      if (target.entityType === 'meaning' && removed.length > 0) {
        await this.bumpMeaningVoteCount(tx, target.entityId, -removed.length);
      }
      return removed.length;
    });
  }

  async resetByClientId(clientId: string): Promise<number> {
    return this.db.transaction(async (tx) => {
      const removed = await tx
        .delete(votes)
        .where(eq(votes.clientId, clientId))
        .returning({ entityType: votes.entityType, entityId: votes.entityId });
      // Kelompokkan makna terdampak lalu kurangi totalnya masing-masing.
      const byMeaning = new Map<string, number>();
      for (const r of removed) {
        if (r.entityType !== 'meaning') continue;
        byMeaning.set(r.entityId, (byMeaning.get(r.entityId) ?? 0) + 1);
      }
      for (const [meaningId, n] of byMeaning) {
        await this.bumpMeaningVoteCount(tx, meaningId, -n);
      }
      return removed.length;
    });
  }

  async getTopTargets(entityType: VoteTargetType, limit: number): Promise<AdminTopVoteTarget[]> {
    // ponytail: order by expression, not alias - drizzle select keys aren't SQL AS aliases
    const netExpr = sql<number>`coalesce(sum(${votes.value}), 0)`.mapWith(Number);
    const rows = await this.db
      .select({
        entityType: votes.entityType,
        entityId: votes.entityId,
        upvotes: sql<number>`sum(case when ${votes.value} = 1 then 1 else 0 end)`.mapWith(Number),
        downvotes: sql<number>`sum(case when ${votes.value} = -1 then 1 else 0 end)`.mapWith(Number),
        net: netExpr,
      })
      .from(votes)
      .where(eq(votes.entityType, entityType))
      .groupBy(votes.entityType, votes.entityId)
      .orderBy(desc(netExpr))
      .limit(limit);

    const previewMap = await this.resolveTargetPreviews(
      rows.map((r) => ({
        entityType: r.entityType as VoteTargetType,
        entityId: r.entityId,
      })),
    );

    return rows.map((r) => ({
      entityType: r.entityType as VoteTargetType,
      entityId: r.entityId,
      upvotes: r.upvotes,
      downvotes: r.downvotes,
      net: r.net,
      targetPreview:
        previewMap.get(voteTargetKey({ entityType: r.entityType as VoteTargetType, entityId: r.entityId })) ??
        null,
    }));
  }

  async resolveWordOwnerForVoteTarget(
    target: VoteTarget,
  ): Promise<{ wordId: string; lemma: string; ownerUserId: string | null } | null> {
    if (
      target.entityType === 'discussion' ||
      target.entityType === 'discussion_reply'
    ) {
      return null;
    }

    const map = await this.resolveParentWords([
      { entityType: target.entityType, entityId: target.entityId },
    ]);
    const parent = map.get(voteTargetKey(target));
    if (!parent) return null;

    const [row] = await this.db
      .select({ createdBy: words.createdBy, lemma: words.lemma })
      .from(words)
      .where(and(eq(words.id, parent.id), isNull(words.deletedAt)))
      .limit(1);
    if (!row) return null;

    return {
      wordId: parent.id,
      lemma: row.lemma,
      ownerUserId: row.createdBy,
    };
  }

  async listByUser(userId: string, opts: VoteHistoryListOptions): Promise<VoteHistoryListResult> {
    const rows = await this.db
      .select({
        id: votes.id,
        entityType: votes.entityType,
        entityId: votes.entityId,
        value: votes.value,
        createdAt: votes.createdAt,
      })
      .from(votes)
      .where(
        and(
          eq(votes.userId, userId),
          opts.targetType ? eq(votes.entityType, opts.targetType) : undefined,
          opts.value !== undefined ? eq(votes.value, opts.value) : undefined,
          opts.cursor ? lt(votes.id, opts.cursor) : undefined,
        ),
      )
      .orderBy(desc(votes.id))
      .limit(opts.limit + 1);

    const hasMore = rows.length > opts.limit;
    const page = hasMore ? rows.slice(0, opts.limit) : rows;
    const wordMap = await this.resolveParentWords(
      page.map((row) => ({
        entityType: row.entityType as VoteTargetType,
        entityId: row.entityId,
      })),
    );

    const items: VoteHistoryItem[] = page.map((row) => {
      const target = { entityType: row.entityType as VoteTargetType, entityId: row.entityId };
      return {
        id: row.id,
        entityType: target.entityType,
        entityId: target.entityId,
        value: row.value === 1 ? 1 : -1,
        votedAt: row.createdAt,
        word: wordMap.get(voteTargetKey(target)) ?? null,
      };
    });

    const last = page[page.length - 1];
    return {
      items,
      nextCursor: hasMore && last ? last.id : null,
      hasMore,
    };
  }

  /**
   * Batch kata induk per jenis target. Satu query per jenis, lalu satu
   * query words. Kata soft-delete atau parent hilang tidak masuk map
   * (pemanggil mengisi `word: null` tanpa membuang baris vote).
   */
  private async resolveParentWords(
    targets: { entityType: VoteTargetType; entityId: string }[],
  ): Promise<Map<string, VoteHistoryWord>> {
    const out = new Map<string, VoteHistoryWord>();
    if (targets.length === 0) return out;

    const idsByType = new Map<VoteTargetType, string[]>();
    for (const target of targets) {
      const list = idsByType.get(target.entityType) ?? [];
      list.push(target.entityId);
      idsByType.set(target.entityType, list);
    }

    const wordIdByTarget = new Map<string, string>();

    const directWordIds = [...new Set(idsByType.get('word') ?? [])];
    for (const id of directWordIds) {
      wordIdByTarget.set(voteTargetKey({ entityType: 'word', entityId: id }), id);
    }

    const meaningIds = [...new Set(idsByType.get('meaning') ?? [])];
    const exampleIds = [...new Set(idsByType.get('example') ?? [])];
    const pronunciationIds = [...new Set(idsByType.get('pronunciation') ?? [])];
    const imageIds = [...new Set(idsByType.get('word_image') ?? [])];
    const commentIds = [...new Set(idsByType.get('comment') ?? [])];

    const [meaningRows, exampleRows, pronunciationRows, imageRows, commentRows] = await Promise.all([
      meaningIds.length > 0
        ? this.db
            .select({ id: meanings.id, wordId: meanings.wordId })
            .from(meanings)
            .where(inArray(meanings.id, meaningIds))
        : Promise.resolve([]),
      exampleIds.length > 0
        ? this.db
            .select({ id: examples.id, meaningId: examples.meaningId })
            .from(examples)
            .where(inArray(examples.id, exampleIds))
        : Promise.resolve([]),
      pronunciationIds.length > 0
        ? this.db
            .select({ id: pronunciations.id, wordId: pronunciations.wordId })
            .from(pronunciations)
            .where(inArray(pronunciations.id, pronunciationIds))
        : Promise.resolve([]),
      imageIds.length > 0
        ? this.db
            .select({ id: wordImages.id, wordId: wordImages.wordId })
            .from(wordImages)
            .where(inArray(wordImages.id, imageIds))
        : Promise.resolve([]),
      commentIds.length > 0
        ? this.db
            .select({ id: comments.id, wordId: comments.wordId })
            .from(comments)
            .where(inArray(comments.id, commentIds))
        : Promise.resolve([]),
    ]);

    for (const row of meaningRows) {
      wordIdByTarget.set(voteTargetKey({ entityType: 'meaning', entityId: row.id }), row.wordId);
    }
    for (const row of pronunciationRows) {
      wordIdByTarget.set(voteTargetKey({ entityType: 'pronunciation', entityId: row.id }), row.wordId);
    }
    for (const row of imageRows) {
      wordIdByTarget.set(voteTargetKey({ entityType: 'word_image', entityId: row.id }), row.wordId);
    }
    for (const row of commentRows) {
      wordIdByTarget.set(voteTargetKey({ entityType: 'comment', entityId: row.id }), row.wordId);
    }

    if (exampleRows.length > 0) {
      const parentMeaningIds = [...new Set(exampleRows.map((row) => row.meaningId))];
      const parentMeanings = await this.db
        .select({ id: meanings.id, wordId: meanings.wordId })
        .from(meanings)
        .where(inArray(meanings.id, parentMeaningIds));
      const wordByMeaning = new Map(parentMeanings.map((row) => [row.id, row.wordId]));
      for (const row of exampleRows) {
        const wordId = wordByMeaning.get(row.meaningId);
        if (wordId) {
          wordIdByTarget.set(voteTargetKey({ entityType: 'example', entityId: row.id }), wordId);
        }
      }
    }

    const parentWordIds = [...new Set(wordIdByTarget.values())];
    if (parentWordIds.length === 0) return out;

    const wordRows = await this.db
      .select({
        id: words.id,
        lemma: words.lemma,
        wordType: words.wordType,
        isVerified: words.isVerified,
      })
      .from(words)
      .where(and(inArray(words.id, parentWordIds), isNull(words.deletedAt)));

    const summaryById = new Map<string, VoteHistoryWord>(
      wordRows.map((row) => [
        row.id,
        { id: row.id, lemma: row.lemma, wordType: row.wordType, isVerified: row.isVerified },
      ]),
    );

    for (const [key, wordId] of wordIdByTarget) {
      const summary = summaryById.get(wordId);
      if (summary) out.set(key, summary);
    }
    return out;
  }

  /**
   * Batch label target untuk panel admin (hindari N+1). Komentar → body;
   * word → lemma; meaning → definition; example → source_sentence;
   * pronunciation → value IPA; word_image → alt_text / url singkat.
   */
  private async resolveTargetPreviews(
    targets: { entityType: VoteTargetType; entityId: string }[],
  ): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (targets.length === 0) return out;

    const idsByType = new Map<VoteTargetType, string[]>();
    for (const t of targets) {
      const list = idsByType.get(t.entityType) ?? [];
      list.push(t.entityId);
      idsByType.set(t.entityType, list);
    }

    const jobs: Promise<void>[] = [];

    const commentIds = [...new Set(idsByType.get('comment') ?? [])];
    if (commentIds.length > 0) {
      jobs.push(
        this.db
          .select({ id: comments.id, body: comments.body })
          .from(comments)
          .where(inArray(comments.id, commentIds))
          .then((rows) => {
            for (const r of rows) out.set(voteTargetKey({ entityType: 'comment', entityId: r.id }), clipPreview(r.body));
          }),
      );
    }

    const wordIds = [...new Set(idsByType.get('word') ?? [])];
    if (wordIds.length > 0) {
      jobs.push(
        this.db
          .select({ id: words.id, lemma: words.lemma })
          .from(words)
          .where(inArray(words.id, wordIds))
          .then((rows) => {
            for (const r of rows) out.set(voteTargetKey({ entityType: 'word', entityId: r.id }), clipPreview(r.lemma));
          }),
      );
    }

    const meaningIds = [...new Set(idsByType.get('meaning') ?? [])];
    if (meaningIds.length > 0) {
      jobs.push(
        this.db
          .select({ id: meanings.id, definition: meanings.definition })
          .from(meanings)
          .where(inArray(meanings.id, meaningIds))
          .then((rows) => {
            for (const r of rows)
              out.set(voteTargetKey({ entityType: 'meaning', entityId: r.id }), clipPreview(r.definition));
          }),
      );
    }

    const exampleIds = [...new Set(idsByType.get('example') ?? [])];
    if (exampleIds.length > 0) {
      jobs.push(
        this.db
          .select({ id: examples.id, sourceSentence: examples.sourceSentence })
          .from(examples)
          .where(inArray(examples.id, exampleIds))
          .then((rows) => {
            for (const r of rows)
              out.set(
                voteTargetKey({ entityType: 'example', entityId: r.id }),
                clipPreview(r.sourceSentence),
              );
          }),
      );
    }

    const pronunciationIds = [...new Set(idsByType.get('pronunciation') ?? [])];
    if (pronunciationIds.length > 0) {
      jobs.push(
        this.db
          .select({ id: pronunciations.id, value: pronunciations.value })
          .from(pronunciations)
          .where(inArray(pronunciations.id, pronunciationIds))
          .then((rows) => {
            for (const r of rows)
              out.set(voteTargetKey({ entityType: 'pronunciation', entityId: r.id }), clipPreview(r.value));
          }),
      );
    }

    const imageIds = [...new Set(idsByType.get('word_image') ?? [])];
    if (imageIds.length > 0) {
      jobs.push(
        this.db
          .select({ id: wordImages.id, altText: wordImages.altText, url: wordImages.url })
          .from(wordImages)
          .where(inArray(wordImages.id, imageIds))
          .then((rows) => {
            for (const r of rows) {
              const label = r.altText?.trim() || r.url;
              out.set(voteTargetKey({ entityType: 'word_image', entityId: r.id }), clipPreview(label));
            }
          }),
      );
    }

    const replyIds = [...new Set(idsByType.get('discussion_reply') ?? [])];
    if (replyIds.length > 0) {
      jobs.push(
        this.db
          .select({ id: discussionReplies.id, body: discussionReplies.body })
          .from(discussionReplies)
          .where(inArray(discussionReplies.id, replyIds))
          .then((rows) => {
            for (const r of rows) {
              out.set(
                voteTargetKey({ entityType: 'discussion_reply', entityId: r.id }),
                clipPreview(r.body),
              );
            }
          }),
      );
    }

    const discussionIds = [...new Set(idsByType.get('discussion') ?? [])];
    if (discussionIds.length > 0) {
      jobs.push(
        this.db
          .select({ id: discussions.id, body: discussions.body })
          .from(discussions)
          .where(inArray(discussions.id, discussionIds))
          .then((rows) => {
            for (const r of rows) {
              out.set(
                voteTargetKey({ entityType: 'discussion', entityId: r.id }),
                clipPreview(r.body?.trim() || 'Pertanyaan diskusi'),
              );
            }
          }),
      );
    }

    await Promise.all(jobs);
    return out;
  }

  /**
   * Antrean deck per MAKNA (0101): published + feed-safe + user belum vote
   * dan belum skip. Urut totalVotes ASC, approvedAt ASC, meaningId ASC.
   */
  async listDeckMeanings(userId: string, opts: VoteDeckListOptions): Promise<VoteDeckListResult> {
    const approvedAtExpr = sql`COALESCE(${words.verifiedAt}, ${words.createdAt})`;
    // 0101: total dari tabel ringkasan makna - bukan COUNT(*) correlated.
    const totalVotesExpr = sql<number>`coalesce(${meaningVoteCounts.total}, 0)`.mapWith(Number);

    const feedSafe = and(
      ...FEED_EXCLUDED_USAGE_LABELS.map(
        (label) => sql`${words.usageLabels} NOT LIKE ${`%"${label}"%`}`,
      ),
    );

    const userNotVoted = notExists(
      this.db
        .select({ id: votes.id })
        .from(votes)
        .where(
          and(
            eq(votes.userId, userId),
            eq(votes.entityType, 'meaning'),
            eq(votes.entityId, meanings.id),
          ),
        ),
    );

    const userNotSkipped = notExists(
      this.db
        .select({ id: userSkips.id })
        .from(userSkips)
        .where(
          and(
            eq(userSkips.userId, userId),
            eq(userSkips.targetType, 'meaning'),
            eq(userSkips.targetId, meanings.id),
          ),
        ),
    );

    let cursorClause;
    if (opts.cursor) {
      const epoch = Math.floor(opts.cursor.approvedAt.getTime() / 1000);
      cursorClause = sql`(
        ${totalVotesExpr},
        ${approvedAtExpr},
        ${meanings.id}
      ) > (
        ${opts.cursor.totalVotes},
        ${epoch},
        ${opts.cursor.id}
      )`;
    }

    const rows = await this.db
      .select({
        id: meanings.id,
        wordId: meanings.wordId,
        // Posisi 1-based antar makna PUBLISHED kata ini, plus totalnya.
        // `meanings.order_index` mentah tidak bisa dipakai langsung: jalur
        // tulis campur 0-based (`existingMeanings.length`) dan 1-based
        // (validator create `min(1)`), jadi "Makna ke-N" bisa salah.
        // Keduanya scalar subquery ber-index - tetap SATU query.
        orderIndex: sql<number>`(
          1 + (
            select count(*) from ${meanings} m3
            where m3.word_id = ${meanings.wordId}
              and m3.deleted_at is null
              and m3.status = 'published'
              and (
                m3.order_index < ${meanings.orderIndex}
                or (m3.order_index = ${meanings.orderIndex} and m3.id < ${meanings.id})
              )
          )
        )`.mapWith(Number),
        meaningCount: sql<number>`(
          select count(*) from ${meanings} m2
          where m2.word_id = ${meanings.wordId}
            and m2.deleted_at is null
            and m2.status = 'published'
        )`.mapWith(Number),
        definition: meanings.definition,
        isHaveDefinition: meanings.isHaveDefinition,
        lemma: words.lemma,
        languageId: words.languageId,
        languageCode: languages.code,
        wordType: words.wordType,
        usageLabels: words.usageLabels,
        isVerified: words.isVerified,
        status: words.status,
        verifiedAt: words.verifiedAt,
        createdAt: words.createdAt,
        totalVotes: totalVotesExpr,
      })
      .from(meanings)
      .innerJoin(words, eq(meanings.wordId, words.id))
      .innerJoin(languages, eq(words.languageId, languages.id))
      .leftJoin(meaningVoteCounts, eq(meaningVoteCounts.meaningId, meanings.id))
      .where(
        and(
          isNull(meanings.deletedAt),
          eq(meanings.status, 'published'),
          isNull(words.deletedAt),
          eq(words.status, 'published'),
          feedSafe,
          userNotVoted,
          userNotSkipped,
          cursorClause,
        ),
      )
      .orderBy(asc(totalVotesExpr), asc(approvedAtExpr), asc(meanings.id))
      .limit(opts.limit + 1);

    const hasMore = rows.length > opts.limit;
    const pageRows = hasMore ? rows.slice(0, opts.limit) : rows;

    // usage_labels is typed UsageLabel[] by the schema. A predicate `x is string`
    // is illegal there: predicates may only narrow, and string is wider than
    // the closed union. Widen to unknown so the JSON guard can drop non-strings.
    const page: VoteDeckMeaning[] = pageRows.map((r) => ({
      id: r.id,
      wordId: r.wordId,
      orderIndex: r.orderIndex,
      meaningCount: r.meaningCount,
      sense: null,
      lemma: r.lemma,
      languageId: r.languageId,
      languageCode: r.languageCode,
      wordType: r.wordType,
      usageLabels: (Array.isArray(r.usageLabels)
        ? (r.usageLabels as unknown[]).filter((x): x is string => typeof x === 'string')
        : []) as string[],
      status: r.status,
      isVerified: r.isVerified,
      approvedAt: (r.verifiedAt ?? r.createdAt) as Date,
      upvotes: 0,
      downvotes: 0,
      totalVotes: r.totalVotes,
    }));

    // Sense kartu: definisi makna ITU dari row utama (tanpa query tambahan).
    const needTranslation: string[] = [];
    const byId = new Map(page.map((p) => [p.id, p]));
    for (const r of pageRows) {
      const item = byId.get(r.id);
      if (!item) continue;
      const definition = r.definition.trim();
      if (r.isHaveDefinition && definition.length > 0 && definition !== '-') {
        item.sense = definition;
      } else {
        needTranslation.push(r.id);
      }
    }

    // Fallback terjemahan pertama (semantik listLatest) - hanya makna tanpa
    // definisi. Query tambahan bersyarat; deck dengan definisi lengkap
    // tidak membayarnya.
    if (needTranslation.length > 0) {
      const translationRows = await this.db
        .select({
          meaningId: meaningTranslations.meaningId,
          translationText: meaningTranslations.translationText,
        })
        .from(meaningTranslations)
        .where(
          and(
            inArray(meaningTranslations.meaningId, needTranslation),
            isNull(meaningTranslations.deletedAt),
            ne(meaningTranslations.translationText, '-'),
          ),
        )
        .orderBy(asc(meaningTranslations.id));

      const textByMeaning = new Map<string, string>();
      for (const row of translationRows) {
        const text = row.translationText.trim();
        if (!text || textByMeaning.has(row.meaningId)) continue;
        textByMeaning.set(row.meaningId, text);
      }
      for (const id of needTranslation) {
        const item = byId.get(id)!;
        item.sense = textByMeaning.get(id) ?? null;
      }
    }

    await this.attachDeckCounts(page);

    // Cursor dihitung dari urutan keyset asli SEBELUM diacak - kalau tidak,
    // halaman berikutnya bisa lompat/duplikat. Sumber nilai = item page
    // (sudah lewat attachDeckCounts), bukan row mentah, agar keyset sama
    // persis dengan yang dipakai query sebelumnya.
    const last = pageRows.length > 0 ? page[page.length - 1] : undefined;
    const items = opts.randomize
      ? seededShuffle(page, `${userId}:${opts.cursor?.id ?? 'first'}`)
      : page;
    return {
      items,
      nextCursor:
        hasMore && last
          ? encodeVoteDeckCursor({
              totalVotes: last.totalVotes,
              approvedAt: last.approvedAt,
              id: last.id,
            })
          : null,
      hasMore,
    };
  }

  private async attachDeckCounts(page: VoteDeckMeaning[]): Promise<void> {
    if (page.length === 0) return;
    const targets = page.map((m) => ({ entityType: 'meaning' as const, entityId: m.id }));
    const counts = await this.countMany(targets);
    for (const item of page) {
      const c = counts.get(voteTargetKey({ entityType: 'meaning', entityId: item.id }));
      item.upvotes = c?.upvotes ?? 0;
      item.downvotes = c?.downvotes ?? 0;
      item.totalVotes = item.upvotes + item.downvotes;
    }
  }
}
