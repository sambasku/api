import { and, desc, eq, inArray, isNull, lt, ne, sql } from 'drizzle-orm';
import { userRoles } from '@/shared/database/drizzle/schema';
import {
  comments,
  contributionReviews,
  contributions,
  examples,
  meanings,
  pronunciations,
  users,
  votes,
  wordAudios,
  wordImages,
  words,
} from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { derivePrimaryRole } from '@/shared/utils/derive-primary-role';
import type {
  MentionUserRow,
  PublicActivityItem,
  PublicActivityPage,
  PublicProfileStats,
  PublicUserRow,
} from '../domain/entities/public-profile.entity';
import type { PublicUserRepository } from '../domain/repositories/public-user.repository';

const ENTITY_LABEL: Record<string, string> = {
  word: 'Kata',
  meaning: 'Makna',
  pronunciation: 'Pelafalan',
  word_image: 'Gambar',
  word_audio: 'Audio',
  example: 'Contoh',
};

/** Param list aktivitas per kategori: keyset cursor ULID (id < cursor). */
interface RecentListParams {
  limit: number;
  cursor?: string;
}

/** Slice pasangan (id, item) (limit + 1) jadi halaman + keyset cursor. */
function toPage(
  rows: Array<{ id: string; item: PublicActivityItem }>,
  limit: number,
): PublicActivityPage {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  return {
    items: page.map((row) => row.item),
    nextCursor: hasMore && last ? last.id : null,
    hasMore,
  };
}

export class PublicUserRepositoryImpl implements PublicUserRepository {
  constructor(private readonly db: AppDatabase) {}

  async findPublicByUsername(username: string): Promise<PublicUserRow | null> {
    const [row] = await this.db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        bio: users.bio,
        joinedAt: users.createdAt,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(and(eq(users.username, username), isNull(users.deletedAt), eq(users.isActive, true)))
      .limit(1);
    if (!row) return null;
    const roles = await this.db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, row.id));
    const roleList = roles.map((r) => r.role);

    return {
      id: row.id,
      username: row.username,
      displayName: row.displayName || row.username,
      bio: row.bio ?? null,
      roles: roleList,
      role: derivePrimaryRole(roleList),
      joinedAt: row.joinedAt,
      avatarUrl: row.avatarUrl ?? null,
    };
  }

  /** Prefix-search username untuk autocomplete mention. Kolom publik saja. */
  async suggestByUsernamePrefix(prefix: string, limit: number): Promise<MentionUserRow[]> {
    const rows = await this.db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(
        and(
          sql`${users.username} LIKE ${prefix} || '%'`,
          isNull(users.deletedAt),
          eq(users.isActive, true),
        ),
      )
      .orderBy(users.username)
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.displayName || row.username,
      avatarUrl: row.avatarUrl ?? null,
    }));
  }

  async countApprovedContributions(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(contributions)
      .where(
        and(
          eq(contributions.userId, userId),
          inArray(contributions.status, ['approved', 'corrected']),
          isNull(contributions.deletedAt),
        ),
      );
    return row?.count ?? 0;
  }

  async countVerificationsDone(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(contributionReviews)
      .where(
        and(
          eq(contributionReviews.reviewerId, userId),
          ne(contributionReviews.status, 'pending'),
          isNull(contributionReviews.deletedAt),
        ),
      );
    return row?.count ?? 0;
  }

  async countPublishedComments(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(comments)
      .where(
        and(
          eq(comments.userId, userId),
          eq(comments.status, 'published'),
          isNull(comments.deletedAt),
        ),
      );
    return row?.count ?? 0;
  }

  async loadStats(userId: string): Promise<PublicProfileStats> {
    const [contributionsApproved, verificationsDone, commentsPublished] = await Promise.all([
      this.countApprovedContributions(userId),
      this.countVerificationsDone(userId),
      this.countPublishedComments(userId),
    ]);
    return { contributionsApproved, verificationsDone, commentsPublished };
  }

  async listRecentApprovedContributions(
    userId: string,
    { limit, cursor }: RecentListParams,
  ): Promise<PublicActivityPage> {
    // limit + 1 = deteksi hasMore tanpa count terpisah.
    const rows = await this.db
      .select({
        id: contributions.id,
        entityType: contributions.entityType,
        entityId: contributions.entityId,
        createdAt: contributions.createdAt,
      })
      .from(contributions)
      .where(
        and(
          eq(contributions.userId, userId),
          inArray(contributions.status, ['approved', 'corrected']),
          isNull(contributions.deletedAt),
          cursor ? lt(contributions.id, cursor) : undefined,
        ),
      )
      .orderBy(desc(contributions.id))
      .limit(limit + 1);

    const resolved = await this.resolveContributionParents(rows);
    return toPage(
      rows.map((row) => {
        const parent = resolved.get(`${row.entityType}:${row.entityId}`);
        const label = ENTITY_LABEL[row.entityType] ?? row.entityType;
        const lemma = parent?.lemma ?? null;
        return {
          id: row.id,
          item: {
            kind: 'contribution' as const,
            id: row.id,
            occurredAt: row.createdAt,
            wordId: parent?.wordId ?? null,
            lemma,
            summary: lemma ? `${label}: ${lemma}` : label,
          },
        };
      }),
      limit,
    );
  }

  async listRecentPublishedComments(
    userId: string,
    { limit, cursor }: RecentListParams,
  ): Promise<PublicActivityPage> {
    const rows = await this.db
      .select({
        id: comments.id,
        body: comments.body,
        wordId: comments.wordId,
        createdAt: comments.createdAt,
        lemma: words.lemma,
      })
      .from(comments)
      .innerJoin(words, eq(comments.wordId, words.id))
      .where(
        and(
          eq(comments.userId, userId),
          eq(comments.status, 'published'),
          isNull(comments.deletedAt),
          cursor ? lt(comments.id, cursor) : undefined,
        ),
      )
      .orderBy(desc(comments.id))
      .limit(limit + 1);

    return toPage(
      rows.map((row) => {
        const snippet =
          row.body.length > 120 ? `${row.body.slice(0, 117)}…` : row.body;
        return {
          id: row.id,
          item: {
            kind: 'comment' as const,
            id: row.id,
            occurredAt: row.createdAt,
            wordId: row.wordId,
            lemma: row.lemma,
            summary: snippet,
          },
        };
      }),
      limit,
    );
  }

  async listRecentVerifications(
    userId: string,
    { limit, cursor }: RecentListParams,
  ): Promise<PublicActivityPage> {
    const rows = await this.db
      .select({
        id: contributionReviews.id,
        createdAt: contributionReviews.createdAt,
        entityType: contributions.entityType,
        entityId: contributions.entityId,
      })
      .from(contributionReviews)
      .innerJoin(contributions, eq(contributionReviews.contributionId, contributions.id))
      .where(
        and(
          eq(contributionReviews.reviewerId, userId),
          ne(contributionReviews.status, 'pending'),
          isNull(contributionReviews.deletedAt),
          cursor ? lt(contributionReviews.id, cursor) : undefined,
        ),
      )
      .orderBy(desc(contributionReviews.id))
      .limit(limit + 1);

    const resolved = await this.resolveContributionParents(rows);
    return toPage(
      rows.map((row) => {
        const parent = resolved.get(`${row.entityType}:${row.entityId}`);
        const label = ENTITY_LABEL[row.entityType] ?? row.entityType;
        const lemma = parent?.lemma ?? null;
        return {
          id: row.id,
          item: {
            kind: 'verification' as const,
            id: row.id,
            occurredAt: row.createdAt,
            wordId: parent?.wordId ?? null,
            lemma,
            summary: lemma
              ? `Memverifikasi ${label}: ${lemma}`
              : `Memverifikasi ${label}`,
          },
        };
      }),
      limit,
    );
  }

  async listRecentVotes(
    userId: string,
    { limit, cursor }: RecentListParams,
  ): Promise<PublicActivityPage> {
    // Vote publik user, hanya target bersistem kata (word/comment) yang
    // katanya masih feed-visible: navigasi tetap menuju halaman kata.
    // Target lain (discussion, discussion_reply) tidak punya lemma - dibuang.
    // ponytail: dua query terpisah (vote word vs vote comment) lalu merge -
    // target polymorphic tanpa FK tidak bisa satu FROM bersih.
    // Upgrade: kolom word_id denormalized di votes.
    const select = {
      id: votes.id,
      value: votes.value,
      updatedAt: votes.updatedAt,
      createdAt: votes.createdAt,
      lemma: words.lemma,
      wordId: words.id,
    };

    const wordVotes = await this.db
      .select(select)
      .from(votes)
      .innerJoin(
        words,
        and(eq(votes.entityType, 'word'), eq(words.id, votes.entityId)),
      )
      .where(
        and(
          eq(votes.userId, userId),
          eq(votes.entityType, 'word'),
          isNull(words.deletedAt),
          eq(words.status, 'published'),
          cursor ? lt(votes.id, cursor) : undefined,
        ),
      )
      .orderBy(desc(votes.id))
      .limit(limit + 1);

    const commentVotes = await this.db
      .select(select)
      .from(votes)
      .innerJoin(
        comments,
        and(eq(votes.entityType, 'comment'), eq(comments.id, votes.entityId)),
      )
      .innerJoin(words, eq(words.id, comments.wordId))
      .where(
        and(
          eq(votes.userId, userId),
          eq(votes.entityType, 'comment'),
          isNull(words.deletedAt),
          eq(words.status, 'published'),
          cursor ? lt(votes.id, cursor) : undefined,
        ),
      )
      .orderBy(desc(votes.id))
      .limit(limit + 1);

    // Merge dua sumber id-desc, tetap keyset by id (ULID monotonic = urut waktu).
    const merged = [...wordVotes, ...commentVotes]
      .sort((a, b) => b.id.localeCompare(a.id))
      .slice(0, limit + 1);

    return toPage(
      merged.map((row) => {
        const quoted = `"${row.lemma}"`;
        // Copy identik dengan feed beranda: mobile membaca arah vote dari
        // akhiran body ("perlu dicek ulang" = down, selain itu up).
        return {
          id: row.id,
          item: {
            kind: 'vote' as const,
            id: row.id,
            occurredAt: row.updatedAt ?? row.createdAt,
            wordId: row.wordId,
            lemma: row.lemma,
            summary:
              row.value >= 0
                ? `${quoted} sudah pas`
                : `${quoted} perlu dicek ulang`,
          },
        };
      }),
      limit,
    );
  }

  private async resolveContributionParents(
    items: Array<{ entityType: string; entityId: string }>,
  ): Promise<Map<string, { lemma: string; wordId: string }>> {
    const out = new Map<string, { lemma: string; wordId: string }>();
    if (items.length === 0) return out;

    const idsOf = (type: string) =>
      items.filter((i) => i.entityType === type).map((i) => i.entityId);

    const wordIds = idsOf('word');
    if (wordIds.length > 0) {
      const rows = await this.db
        .select({ id: words.id, lemma: words.lemma })
        .from(words)
        .where(inArray(words.id, wordIds));
      for (const r of rows) out.set(`word:${r.id}`, { lemma: r.lemma, wordId: r.id });
    }

    const pronIds = idsOf('pronunciation');
    if (pronIds.length > 0) {
      const rows = await this.db
        .select({ id: pronunciations.id, lemma: words.lemma, wordId: pronunciations.wordId })
        .from(pronunciations)
        .innerJoin(words, eq(pronunciations.wordId, words.id))
        .where(inArray(pronunciations.id, pronIds));
      for (const r of rows)
        out.set(`pronunciation:${r.id}`, { lemma: r.lemma, wordId: r.wordId });
    }

    const imageIds = idsOf('word_image');
    if (imageIds.length > 0) {
      const rows = await this.db
        .select({ id: wordImages.id, lemma: words.lemma, wordId: wordImages.wordId })
        .from(wordImages)
        .innerJoin(words, eq(wordImages.wordId, words.id))
        .where(inArray(wordImages.id, imageIds));
      for (const r of rows)
        out.set(`word_image:${r.id}`, { lemma: r.lemma, wordId: r.wordId });
    }

    const audioIds = idsOf('word_audio');
    if (audioIds.length > 0) {
      const rows = await this.db
        .select({ id: wordAudios.id, lemma: words.lemma, wordId: wordAudios.wordId })
        .from(wordAudios)
        .innerJoin(words, eq(wordAudios.wordId, words.id))
        .where(inArray(wordAudios.id, audioIds));
      for (const r of rows)
        out.set(`word_audio:${r.id}`, { lemma: r.lemma, wordId: r.wordId });
    }

    const meaningIds = idsOf('meaning');
    if (meaningIds.length > 0) {
      const rows = await this.db
        .select({ id: meanings.id, lemma: words.lemma, wordId: meanings.wordId })
        .from(meanings)
        .innerJoin(words, eq(meanings.wordId, words.id))
        .where(inArray(meanings.id, meaningIds));
      for (const r of rows)
        out.set(`meaning:${r.id}`, { lemma: r.lemma, wordId: r.wordId });
    }

    const exampleIds = idsOf('example');
    if (exampleIds.length > 0) {
      const rows = await this.db
        .select({ id: examples.id, lemma: words.lemma, wordId: meanings.wordId })
        .from(examples)
        .innerJoin(meanings, eq(examples.meaningId, meanings.id))
        .innerJoin(words, eq(meanings.wordId, words.id))
        .where(inArray(examples.id, exampleIds));
      for (const r of rows)
        out.set(`example:${r.id}`, { lemma: r.lemma, wordId: r.wordId });
    }

    return out;
  }
}
