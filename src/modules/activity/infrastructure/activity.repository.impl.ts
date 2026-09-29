import { and, desc, eq, inArray, isNull, ne, sql, type SQL } from 'drizzle-orm';
import type { AnyColumn } from 'drizzle-orm';
import {
  comments,
  contributions,
  discussions,
  examples,
  meanings,
  pronunciations,
  searchMisses,
  users,
  votes,
  wordAudios,
  wordImages,
  words,
} from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import { FEED_EXCLUDED_USAGE_LABELS } from '@/shared/constants/usage-labels';
import {
  publicAccountDisplayName,
  publicAccountName,
} from '@/shared/constants/deleted-account';
import type { ActivityItem, ActivityKind } from '../domain/entities/activity-item.entity';
import type { ActivityCursor } from '../domain/merge-activity';
import type { ActivityRepository } from '../domain/repositories/activity.repository';

/**
 * Keyset DESC: baris lebih lama dari cursor.
 * Kind cocok → (time, id) < cursor; kind beda → time < cursor saja.
 */
function keysetBefore(
  timeExpr: SQL | AnyColumn,
  idColumn: AnyColumn,
  before: ActivityCursor | undefined,
  kindOrKinds: string | string[],
): SQL | undefined {
  if (!before) return undefined;
  const colon = before.id.indexOf(':');
  const kind = colon >= 0 ? before.id.slice(0, colon) : '';
  const entityId = colon >= 0 ? before.id.slice(colon + 1) : before.id;
  const kinds = Array.isArray(kindOrKinds) ? kindOrKinds : [kindOrKinds];
  if (kinds.includes(kind) && entityId.length > 0) {
    return sql`(${timeExpr}, ${idColumn}) < (${before.createdAt}, ${entityId})`;
  }
  return sql`${timeExpr} < ${before.createdAt}`;
}

const CONTRIB_BODY: Record<string, string> = {
  word_image: 'Menambah foto',
  word_audio: 'Merekam suara',
  pronunciation: 'Menambah cara baca',
  example: 'Menambah contoh kalimat',
};

function feedSafeUsageLabelsSql() {
  return and(
    ...FEED_EXCLUDED_USAGE_LABELS.map(
      (label) => sql`${words.usageLabels} NOT LIKE ${`%"${label}"%`}`,
    ),
  );
}

function snippet(text: string, max = 120): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function searchMissBody(term: string): string {
  const shown = term.trim() || '…';
  return `Mencari "${shown}" - belum ada di kamus. Bantu isi.`;
}

/** Fulfilled = ada kata published dengan lemma = term (arah lemma). */
const isFulfilledLemmaSql = sql`exists (
  select 1 from ${words}
  where lower(${words.lemma}) = lower(${searchMisses.term})
    and ${words.status} = 'published'
    and ${words.deletedAt} is null
)`;

export class ActivityRepositoryImpl implements ActivityRepository {
  constructor(private readonly db: AppDatabase) {}

  async listRecentWords(
    limit: number,
    before?: ActivityCursor,
  ): Promise<ActivityItem[]> {
    const approvedAtExpr = sql`COALESCE(${words.verifiedAt}, ${words.createdAt})`;
    const rows = await this.db
      .select({
        id: words.id,
        lemma: words.lemma,
        verifiedAt: words.verifiedAt,
        createdAt: words.createdAt,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        authorDeletedAt: users.deletedAt,
      })
      .from(words)
      .leftJoin(users, eq(users.id, words.createdBy))
      .where(
        and(
          isNull(words.deletedAt),
          eq(words.status, 'published'),
          feedSafeUsageLabelsSql(),
          keysetBefore(approvedAtExpr, words.id, before, 'word'),
        ),
      )
      .orderBy(desc(approvedAtExpr), desc(words.id))
      .limit(limit);

    const senses = await this.attachWordSenses(rows.map((r) => r.id));

    return rows.map((row) => {
      const sense = senses.get(row.id);
      const username = publicAccountName(row.username, row.authorDeletedAt);
      const displayName = publicAccountDisplayName(
        row.displayName,
        row.username,
        row.authorDeletedAt,
      );
      return {
        id: `word:${row.id}`,
        kind: 'word' as const,
        createdAt: row.verifiedAt ?? row.createdAt,
        actor:
          username || displayName
            ? {
                username,
                displayName,
                avatarUrl: row.authorDeletedAt ? null : (row.avatarUrl ?? null),
              }
            : null,
        body: sense ? `${row.lemma} · ${snippet(sense, 80)}` : row.lemma,
        subtitle: 'Baru ditambahkan',
        target: { type: 'word', id: row.id },
      };
    });
  }

  async listRecentComments(
    limit: number,
    before?: ActivityCursor,
  ): Promise<ActivityItem[]> {
    const rows = await this.db
      .select({
        id: comments.id,
        body: comments.body,
        wordId: comments.wordId,
        createdAt: comments.createdAt,
        lemma: words.lemma,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        authorDeletedAt: users.deletedAt,
      })
      .from(comments)
      .innerJoin(words, eq(comments.wordId, words.id))
      .leftJoin(users, eq(users.id, comments.userId))
      .where(
        and(
          eq(comments.status, 'published'),
          isNull(comments.deletedAt),
          isNull(words.deletedAt),
          eq(words.status, 'published'),
          keysetBefore(comments.createdAt, comments.id, before, 'comment'),
        ),
      )
      .orderBy(desc(comments.createdAt), desc(comments.id))
      .limit(limit);

    return rows.map((row) => {
      const username = publicAccountName(row.username, row.authorDeletedAt);
      const displayName = publicAccountDisplayName(
        row.displayName,
        row.username,
        row.authorDeletedAt,
      );
      return {
        id: `comment:${row.id}`,
        kind: 'comment' as const,
        createdAt: row.createdAt,
        actor: {
          username,
          displayName,
          avatarUrl: row.authorDeletedAt ? null : (row.avatarUrl ?? null),
        },
        body: snippet(row.body || '…'),
        subtitle: row.lemma,
        target: { type: 'word', id: row.wordId },
      };
    });
  }

  async listRecentVotes(
    limit: number,
    before?: ActivityCursor,
  ): Promise<ActivityItem[]> {
    const occurredAt = sql`COALESCE(${votes.updatedAt}, ${votes.createdAt})`;
    const rows = await this.db
      .select({
        id: votes.id,
        entityType: votes.entityType,
        entityId: votes.entityId,
        value: votes.value,
        createdAt: votes.createdAt,
        updatedAt: votes.updatedAt,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        authorDeletedAt: users.deletedAt,
      })
      .from(votes)
      .innerJoin(users, eq(users.id, votes.userId))
      .where(
        and(
          isNull(users.deletedAt),
          keysetBefore(occurredAt, votes.id, before, 'vote'),
        ),
      )
      .orderBy(desc(occurredAt), desc(votes.id))
      .limit(limit);

    const previewMap = await this.resolveVotePreviews(
      rows.map((r) => ({ entityType: r.entityType, entityId: r.entityId })),
    );

    return rows.map((row) => {
      const username = publicAccountName(row.username, row.authorDeletedAt);
      const displayName = publicAccountDisplayName(
        row.displayName,
        row.username,
        row.authorDeletedAt,
      );
      const preview = previewMap.get(`${row.entityType}:${row.entityId}`);
      const targetLabel = preview?.label || 'entri kamus';
      const body =
        row.value >= 0
          ? `Setuju dengan ${targetLabel}`
          : `Kurang setuju dengan ${targetLabel}`;
      return {
        id: `vote:${row.id}`,
        kind: 'vote' as const,
        createdAt: row.updatedAt ?? row.createdAt,
        actor: {
          username,
          displayName,
          avatarUrl: row.avatarUrl ?? null,
        },
        body,
        subtitle: null,
        target: preview?.wordId
          ? { type: 'word', id: preview.wordId }
          : row.entityType === 'discussion'
            ? { type: 'discussion', id: row.entityId }
            : { type: row.entityType, id: row.entityId },
      };
    });
  }

  async listRecentDiscussions(
    limit: number,
    before?: ActivityCursor,
  ): Promise<ActivityItem[]> {
    const rows = await this.db
      .select({
        id: discussions.id,
        body: discussions.body,
        createdAt: discussions.createdAt,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        authorDeletedAt: users.deletedAt,
      })
      .from(discussions)
      .leftJoin(users, eq(users.id, discussions.userId))
      .where(
        and(
          eq(discussions.status, 'published'),
          keysetBefore(discussions.createdAt, discussions.id, before, 'discussion'),
        ),
      )
      .orderBy(desc(discussions.createdAt), desc(discussions.id))
      .limit(limit);

    return rows.map((row) => {
      const username = publicAccountName(row.username, row.authorDeletedAt);
      const displayName = publicAccountDisplayName(
        row.displayName,
        row.username,
        row.authorDeletedAt,
      );
      const bodyRaw = row.body?.trim() ?? '';
      return {
        id: `discussion:${row.id}`,
        kind: 'discussion' as const,
        createdAt: row.createdAt,
        actor: {
          username,
          displayName,
          avatarUrl: row.authorDeletedAt ? null : (row.avatarUrl ?? null),
        },
        body: bodyRaw ? snippet(bodyRaw) : 'Membuka ruang diskusi',
        subtitle: null,
        target: { type: 'discussion', id: row.id },
      };
    });
  }

  async listRecentApprovedContributions(
    entityTypes: Array<'word_image' | 'word_audio' | 'pronunciation' | 'example'>,
    limit: number,
    before?: ActivityCursor,
  ): Promise<ActivityItem[]> {
    if (entityTypes.length === 0) return [];

    const rows = await this.db
      .select({
        id: contributions.id,
        entityType: contributions.entityType,
        entityId: contributions.entityId,
        createdAt: contributions.createdAt,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        authorDeletedAt: users.deletedAt,
      })
      .from(contributions)
      .leftJoin(users, eq(users.id, contributions.userId))
      .where(
        and(
          inArray(contributions.status, ['approved', 'corrected']),
          isNull(contributions.deletedAt),
          inArray(contributions.entityType, entityTypes),
          keysetBefore(contributions.createdAt, contributions.id, before, entityTypes),
        ),
      )
      .orderBy(desc(contributions.createdAt), desc(contributions.id))
      .limit(limit);

    const parents = await this.resolveContributionParents(
      rows.map((r) => ({ entityType: r.entityType, entityId: r.entityId })),
    );

    return rows.map((row) => {
      const username = publicAccountName(row.username, row.authorDeletedAt);
      const displayName = publicAccountDisplayName(
        row.displayName,
        row.username,
        row.authorDeletedAt,
      );
      const parent = parents.get(`${row.entityType}:${row.entityId}`);
      const action = CONTRIB_BODY[row.entityType] ?? row.entityType;
      const lemma = parent?.lemma;
      const kind = row.entityType as ActivityKind;
      return {
        id: `${kind}:${row.id}`,
        kind,
        createdAt: row.createdAt,
        actor: {
          username,
          displayName,
          avatarUrl: row.authorDeletedAt ? null : (row.avatarUrl ?? null),
        },
        body: lemma ? `${action} · ${lemma}` : action,
        subtitle: lemma ?? null,
        target: parent?.wordId ? { type: 'word', id: parent.wordId } : null,
      };
    });
  }

  async listRecentVisibleSearchMisses(
    limit: number,
    before?: ActivityCursor,
  ): Promise<ActivityItem[]> {
    const occurredAt = sql`COALESCE(${searchMisses.lastSearchedAt}, ${searchMisses.createdAt})`;
    const rows = await this.db
      .select({
        id: searchMisses.id,
        term: searchMisses.term,
        direction: searchMisses.direction,
        createdAt: searchMisses.createdAt,
        lastSearchedAt: searchMisses.lastSearchedAt,
      })
      .from(searchMisses)
      .where(
        and(
          isNull(searchMisses.deletedAt),
          eq(searchMisses.isVisible, true),
          // Arah lemma: belum ada kata published. Translation: tetap tampilkan
          // (klasifikasi penuh mirip repo search-miss; V1 cukup skip lemma fulfilled).
          sql`NOT (
            ${searchMisses.direction} = 'lemma' AND ${isFulfilledLemmaSql}
          )`,
          keysetBefore(occurredAt, searchMisses.id, before, 'search_miss'),
        ),
      )
      .orderBy(desc(searchMisses.lastSearchedAt), desc(searchMisses.id))
      .limit(limit);

    return rows.map((row) => ({
      id: `search_miss:${row.id}`,
      kind: 'search_miss' as const,
      createdAt: row.lastSearchedAt ?? row.createdAt,
      actor: null,
      body: searchMissBody(row.term),
      subtitle: null,
      target: {
        type: 'search_miss',
        id: row.id,
      },
    }));
  }

  async listRecentWelcomes(
    limit: number,
    before?: ActivityCursor,
  ): Promise<ActivityItem[]> {
    // Tampil setelah akun terverifikasi (OTP email atau OAuth langsung verified).
    // Urut createdAt: waktu daftar; filter emailVerified menutup akun belum OTP.
    const rows = await this.db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(
        and(
          eq(users.emailVerified, true),
          eq(users.isActive, true),
          isNull(users.deletedAt),
          ne(users.id, ANONIM_USER_ID),
          keysetBefore(users.createdAt, users.id, before, 'welcome'),
        ),
      )
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(limit);

    return rows.map((row) => {
      const username = publicAccountName(row.username, row.deletedAt);
      const displayName = publicAccountDisplayName(
        row.displayName,
        row.username,
        row.deletedAt,
      );
      return {
        id: `welcome:${row.id}`,
        kind: 'welcome' as const,
        createdAt: row.createdAt,
        actor: {
          username,
          displayName,
          avatarUrl: row.deletedAt ? null : (row.avatarUrl ?? null),
        },
        body: 'Bergabung di SambasKu',
        subtitle: 'Selamat datang',
        target: { type: 'user', id: row.id },
      };
    });
  }

  private async attachWordSenses(wordIds: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (wordIds.length === 0) return out;

    const meaningRows = await this.db
      .select({
        wordId: meanings.wordId,
        definition: meanings.definition,
        isHaveDefinition: meanings.isHaveDefinition,
      })
      .from(meanings)
      .where(
        and(
          inArray(meanings.wordId, wordIds),
          isNull(meanings.deletedAt),
          eq(meanings.status, 'published'),
        ),
      )
      .orderBy(meanings.wordId, meanings.id);

    for (const row of meaningRows) {
      if (out.has(row.wordId)) continue;
      if (row.isHaveDefinition && row.definition?.trim()) {
        out.set(row.wordId, row.definition.trim());
      }
    }
    return out;
  }

  private async resolveVotePreviews(
    targets: Array<{ entityType: string; entityId: string }>,
  ): Promise<Map<string, { label: string; wordId: string | null }>> {
    const out = new Map<string, { label: string; wordId: string | null }>();
    if (targets.length === 0) return out;

    const idsOf = (type: string) =>
      targets.filter((t) => t.entityType === type).map((t) => t.entityId);

    const wordIds = idsOf('word');
    if (wordIds.length > 0) {
      const rows = await this.db
        .select({ id: words.id, lemma: words.lemma })
        .from(words)
        .where(inArray(words.id, wordIds));
      for (const r of rows) out.set(`word:${r.id}`, { label: r.lemma, wordId: r.id });
    }

    const commentIds = idsOf('comment');
    if (commentIds.length > 0) {
      const rows = await this.db
        .select({ id: comments.id, lemma: words.lemma, wordId: comments.wordId })
        .from(comments)
        .innerJoin(words, eq(words.id, comments.wordId))
        .where(inArray(comments.id, commentIds));
      for (const r of rows) {
        out.set(`comment:${r.id}`, { label: r.lemma, wordId: r.wordId });
      }
    }

    return out;
  }

  private async resolveContributionParents(
    items: Array<{ entityType: string; entityId: string }>,
  ): Promise<Map<string, { lemma: string; wordId: string }>> {
    const out = new Map<string, { lemma: string; wordId: string }>();
    if (items.length === 0) return out;

    const idsOf = (type: string) =>
      items.filter((i) => i.entityType === type).map((i) => i.entityId);

    const pronunciationIds = idsOf('pronunciation');
    if (pronunciationIds.length > 0) {
      const rows = await this.db
        .select({ id: pronunciations.id, lemma: words.lemma, wordId: pronunciations.wordId })
        .from(pronunciations)
        .innerJoin(words, eq(words.id, pronunciations.wordId))
        .where(inArray(pronunciations.id, pronunciationIds));
      for (const r of rows) {
        out.set(`pronunciation:${r.id}`, { lemma: r.lemma, wordId: r.wordId });
      }
    }

    const imageIds = idsOf('word_image');
    if (imageIds.length > 0) {
      const rows = await this.db
        .select({ id: wordImages.id, lemma: words.lemma, wordId: wordImages.wordId })
        .from(wordImages)
        .innerJoin(words, eq(words.id, wordImages.wordId))
        .where(inArray(wordImages.id, imageIds));
      for (const r of rows) out.set(`word_image:${r.id}`, { lemma: r.lemma, wordId: r.wordId });
    }

    const audioIds = idsOf('word_audio');
    if (audioIds.length > 0) {
      const rows = await this.db
        .select({ id: wordAudios.id, lemma: words.lemma, wordId: wordAudios.wordId })
        .from(wordAudios)
        .innerJoin(words, eq(words.id, wordAudios.wordId))
        .where(inArray(wordAudios.id, audioIds));
      for (const r of rows) out.set(`word_audio:${r.id}`, { lemma: r.lemma, wordId: r.wordId });
    }

    const exampleIds = idsOf('example');
    if (exampleIds.length > 0) {
      const rows = await this.db
        .select({ id: examples.id, lemma: words.lemma, wordId: meanings.wordId })
        .from(examples)
        .innerJoin(meanings, eq(meanings.id, examples.meaningId))
        .innerJoin(words, eq(words.id, meanings.wordId))
        .where(inArray(examples.id, exampleIds));
      for (const r of rows) out.set(`example:${r.id}`, { lemma: r.lemma, wordId: r.wordId });
    }

    return out;
  }
}
