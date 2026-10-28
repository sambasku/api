import { and, asc, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { highestUserRoleSql } from '@/shared/database/highest-user-role-sql';
import {
  publicAccountDisplayName,
  publicAccountName,
} from '@/shared/constants/deleted-account';
import {
  pantuns,
  pantunReplies,
  pantunReplyRevisions,
  users,
} from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type {
  PantunRhymeScheme,
  PantunStatus,
  PantunReplyStatus,
} from '@/shared/database/drizzle/schema/pantun.schema';
import type {
  NewPantun,
  NewPantunReply,
  Pantun,
  PantunListFilter,
  PantunReply,
  PantunReplyRevision,
} from '../domain/entities/pantun.entity';
import type { PantunRepository, PantunSearchHit } from '../domain/repositories/pantun.repository';

type PantunRow = typeof pantuns.$inferSelect;
type ReplyRow = typeof pantunReplies.$inferSelect;

const REPLY_REVISION_CAP = 50;

const replyIsEditedSql = sql<boolean>`EXISTS (
  SELECT 1 FROM ${pantunReplyRevisions}
  WHERE ${pantunReplyRevisions.replyId} = ${pantunReplies.id}
)`;

function toLines(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map((x) => String(x)) : [];
}

/**
 * Baris gabungan hasil search (induk + balasan) - satu query UNION ALL supaya
 * tidak ada N+1 / dua round-trip (AGENTS.md #26). Timestamp dari SQLite
 * integer epoch detik; users.deleted_at dipakai sebagai penanda akun terhapus.
 */
interface PantunSearchRow {
  kind: 'pantun' | 'reply';
  id: string;
  parent_id: string | null;
  user_id: string;
  category_id: string | null;
  language: string;
  rhyme_scheme: string;
  lines: string;
  status: string;
  created_at: number;
  updated_at: number | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  author_deleted_at: number | null;
  user_role: string | null;
  rank: number;
}

function toSearchHit(row: PantunSearchRow): PantunSearchHit {
  const deleted = row.author_deleted_at != null;
  const username = publicAccountName(row.username, deleted ? new Date() : null);
  const displayName = publicAccountDisplayName(
    row.display_name,
    row.username,
    deleted ? new Date() : null,
  );
  const avatarUrl = deleted ? null : (row.avatar_url ?? null);
  const userRole = deleted ? null : (row.user_role ?? null);
  const createdAt = new Date(Number(row.created_at) * 1000);
  const updatedAt =
    row.updated_at == null ? null : new Date(Number(row.updated_at) * 1000);
  const lines = toLines(JSON.parse(row.lines) as unknown);
  if (row.kind === 'reply') {
    return {
      kind: 'reply',
      reply: {
        id: row.id,
        parentId: row.parent_id!,
        userId: row.user_id,
        username,
        displayName,
        avatarUrl,
        userRole,
        categoryId: row.category_id,
        language: row.language,
        rhymeScheme: row.rhyme_scheme as PantunRhymeScheme,
        lines,
        status: row.status as PantunReplyStatus,
        createdAt,
        updatedAt,
      },
    };
  }
  return {
    kind: 'pantun',
    pantun: {
      id: row.id,
      userId: row.user_id,
      username,
      displayName,
      avatarUrl,
      userRole,
      categoryId: row.category_id,
      language: row.language,
      rhymeScheme: row.rhyme_scheme as PantunRhymeScheme,
      lines,
      status: row.status as PantunStatus,
      createdAt,
      updatedAt,
    },
  };
}

/** Term FTS trigram minimal 3 karakter; lebih pendek dilewati (mis. "ik"). */
function ftsMatch(terms: string[]): string | null {
  const usable = terms.filter((t) => t.length >= 3 && !t.includes('"'));
  if (usable.length === 0) return null;
  return usable.map((t) => `"${t}"`).join(' OR ');
}

function toPantun(
  row: PantunRow,
  username: string | null,
  displayName: string | null,
  avatarUrl: string | null,
  userRole: string | null,
): Pantun {
  return {
    id: row.id,
    userId: row.userId,
    username,
    displayName,
    avatarUrl,
    userRole,
    categoryId: row.categoryId,
    language: row.language,
    rhymeScheme: row.rhymeScheme as PantunRhymeScheme,
    lines: toLines(row.lines),
    status: row.status as PantunStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toReply(
  row: ReplyRow,
  username: string | null,
  displayName: string | null,
  avatarUrl: string | null,
  userRole: string | null,
  isEdited = false,
): PantunReply {
  return {
    id: row.id,
    parentId: row.parentId,
    userId: row.userId,
    username,
    displayName,
    avatarUrl,
    userRole,
    categoryId: row.categoryId,
    language: row.language,
    rhymeScheme: row.rhymeScheme as PantunRhymeScheme,
    lines: toLines(row.lines),
    status: row.status as PantunReplyStatus,
    isEdited,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PantunRepositoryImpl implements PantunRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: NewPantun): Promise<Pantun> {
    const [row] = await this.db
      .insert(pantuns)
      .values({
        userId: input.userId,
        categoryId: input.categoryId ?? null,
        language: input.language,
        rhymeScheme: input.rhymeScheme,
        lines: input.lines,
        status: 'published',
      })
      .returning();
    return toPantun(row, null, null, null, null);
  }

  async findById(id: string): Promise<Pantun | null> {
    const [row] = await this.db
      .select({
        pantun: pantuns,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        userRole: highestUserRoleSql,
        authorDeletedAt: users.deletedAt,
      })
      .from(pantuns)
      .leftJoin(users, eq(users.id, pantuns.userId))
      .where(eq(pantuns.id, id))
      .limit(1);
    if (!row) return null;
    return toPantun(
      row.pantun,
      publicAccountName(row.username, row.authorDeletedAt),
      publicAccountDisplayName(row.displayName, row.username, row.authorDeletedAt),
      row.authorDeletedAt ? null : (row.avatarUrl ?? null),
      row.authorDeletedAt ? null : (row.userRole ?? null),
    );
  }

  async list(filter: PantunListFilter): Promise<CursorPage<Pantun>> {
    const status =
      filter.status && filter.status !== 'all' ? filter.status : undefined;
    const rows = await this.db
      .select({
        pantun: pantuns,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        userRole: highestUserRoleSql,
        authorDeletedAt: users.deletedAt,
      })
      .from(pantuns)
      .leftJoin(users, eq(users.id, pantuns.userId))
      .where(
        and(
          status ? eq(pantuns.status, status) : eq(pantuns.status, 'published'),
          filter.categoryId ? eq(pantuns.categoryId, filter.categoryId) : undefined,
          filter.cursor ? lt(pantuns.id, filter.cursor) : undefined,
        ),
      )
      .orderBy(desc(pantuns.id))
      .limit(filter.limit + 1);

    const hasMore = rows.length > filter.limit;
    const page = hasMore ? rows.slice(0, filter.limit) : rows;
    const items = page.map((r) =>
      toPantun(
        r.pantun,
        publicAccountName(r.username, r.authorDeletedAt),
        publicAccountDisplayName(r.displayName, r.username, r.authorDeletedAt),
        r.authorDeletedAt ? null : (r.avatarUrl ?? null),
        r.authorDeletedAt ? null : (r.userRole ?? null),
      ),
    );
    return {
      items,
      nextCursor: hasMore && items.length > 0 ? items[items.length - 1].id : null,
      hasMore,
    };
  }

  async createReply(input: NewPantunReply): Promise<PantunReply> {
    const [row] = await this.db
      .insert(pantunReplies)
      .values({
        parentId: input.parentId,
        userId: input.userId,
        categoryId: input.categoryId ?? null,
        language: input.language,
        rhymeScheme: input.rhymeScheme,
        lines: input.lines,
        status: 'published',
      })
      .returning();
    return toReply(row, null, null, null, null);
  }

  async findReplyById(id: string): Promise<PantunReply | null> {
    const [row] = await this.db
      .select({
        reply: pantunReplies,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        userRole: highestUserRoleSql,
        authorDeletedAt: users.deletedAt,
        isEdited: replyIsEditedSql,
      })
      .from(pantunReplies)
      .leftJoin(users, eq(users.id, pantunReplies.userId))
      .where(eq(pantunReplies.id, id))
      .limit(1);
    if (!row) return null;
    return toReply(
      row.reply,
      publicAccountName(row.username, row.authorDeletedAt),
      publicAccountDisplayName(row.displayName, row.username, row.authorDeletedAt),
      row.authorDeletedAt ? null : (row.avatarUrl ?? null),
      row.authorDeletedAt ? null : (row.userRole ?? null),
      Boolean(row.isEdited),
    );
  }

  async listReplies(parentId: string): Promise<PantunReply[]> {
    const rows = await this.db
      .select({
        reply: pantunReplies,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        userRole: highestUserRoleSql,
        authorDeletedAt: users.deletedAt,
        isEdited: replyIsEditedSql,
      })
      .from(pantunReplies)
      .leftJoin(users, eq(users.id, pantunReplies.userId))
      .where(eq(pantunReplies.parentId, parentId))
      .orderBy(asc(pantunReplies.createdAt), asc(pantunReplies.id));
    return rows.map((r) =>
      toReply(
        r.reply,
        publicAccountName(r.username, r.authorDeletedAt),
        publicAccountDisplayName(r.displayName, r.username, r.authorDeletedAt),
        r.authorDeletedAt ? null : (r.avatarUrl ?? null),
        r.authorDeletedAt ? null : (r.userRole ?? null),
        Boolean(r.isEdited),
      ),
    );
  }

  async updateReplyWithRevision(input: {
    replyId: string;
    editorId: string;
    rhymeScheme: PantunRhymeScheme;
    lines: string[];
    previousRhymeScheme: PantunRhymeScheme;
    previousLines: string[];
  }): Promise<PantunReply | null> {
    const now = new Date();
    const updated = await this.db.transaction(async (tx) => {
      await tx.insert(pantunReplyRevisions).values({
        replyId: input.replyId,
        editorId: input.editorId,
        rhymeScheme: input.previousRhymeScheme,
        lines: input.previousLines,
        createdAt: now,
      });

      const excess = await tx
        .select({ id: pantunReplyRevisions.id })
        .from(pantunReplyRevisions)
        .where(eq(pantunReplyRevisions.replyId, input.replyId))
        .orderBy(desc(pantunReplyRevisions.createdAt))
        .offset(REPLY_REVISION_CAP);
      if (excess.length > 0) {
        await tx
          .delete(pantunReplyRevisions)
          .where(inArray(pantunReplyRevisions.id, excess.map((r) => r.id)));
      }

      const [row] = await tx
        .update(pantunReplies)
        .set({
          lines: input.lines,
          rhymeScheme: input.rhymeScheme,
          updatedAt: now,
        })
        .where(
          and(
            eq(pantunReplies.id, input.replyId),
            eq(pantunReplies.status, 'published'),
            eq(pantunReplies.userId, input.editorId),
          ),
        )
        .returning();
      return row ?? null;
    });

    if (!updated) return null;
    return this.findReplyById(updated.id);
  }

  async listReplyRevisions(replyId: string): Promise<PantunReplyRevision[]> {
    const rows = await this.db
      .select()
      .from(pantunReplyRevisions)
      .where(eq(pantunReplyRevisions.replyId, replyId))
      .orderBy(desc(pantunReplyRevisions.createdAt));
    return rows.map((row) => ({
      id: row.id,
      replyId: row.replyId,
      editorId: row.editorId,
      rhymeScheme: row.rhymeScheme as PantunRhymeScheme,
      lines: toLines(row.lines),
      createdAt: row.createdAt,
    }));
  }

  async listDistinctReplierUserIds(parentId: string): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ userId: pantunReplies.userId })
      .from(pantunReplies)
      .where(
        and(
          eq(pantunReplies.parentId, parentId),
          eq(pantunReplies.status, 'published'),
        ),
      );
    return rows.map((r) => r.userId).filter((id): id is string => !!id);
  }

  async markReplyDeletedByAuthor(id: string, actorId: string): Promise<boolean> {
    const updated = await this.db
      .update(pantunReplies)
      .set({
        status: 'deleted_by_author',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(pantunReplies.id, id),
          eq(pantunReplies.status, 'published'),
          eq(pantunReplies.userId, actorId),
        ),
      )
      .returning({ id: pantunReplies.id });
    return updated.length > 0;
  }

  async markDeletedByAuthor(id: string, actorId: string): Promise<boolean> {
    const updated = await this.db
      .update(pantuns)
      .set({
        status: 'deleted_by_author',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(pantuns.id, id),
          eq(pantuns.status, 'published'),
          eq(pantuns.userId, actorId),
        ),
      )
      .returning({ id: pantuns.id });

    return updated.length > 0;
  }

  async takedownReply(id: string, actorId: string): Promise<boolean> {
    const updated = await this.db
      .update(pantunReplies)
      .set({
        status: 'taken_down',
        takenDownBy: actorId,
        takenDownAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(pantunReplies.id, id),
          eq(pantunReplies.status, 'published'),
        ),
      )
      .returning({ id: pantunReplies.id });
    return updated.length > 0;
  }

  async takedown(id: string, actorId: string): Promise<Pantun | null> {
    const [row] = await this.db
      .update(pantuns)
      .set({
        status: 'taken_down',
        takenDownBy: actorId,
        takenDownAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(pantuns.id, id), eq(pantuns.status, 'published')))
      .returning();
    if (!row) return null;
    return this.findById(row.id);
  }

  /**
   * Cari pantun + balasan published. FTS engine mengembalikan `owner_id`
   * gabungan dua tabel; satu query UNION ALL (bukan dua round-trip).
   * Term < 3 karakter (di luar jangkauan trigram) jatuh ke LIKE.
   */
  async searchPublished(q: string, limit: number): Promise<PantunSearchHit[]> {
    const terms = [...new Set(q.trim().toLowerCase().split(/\s+/).filter(Boolean))].slice(0, 5);
    if (terms.length === 0) return [];
    const match = ftsMatch(terms);

    const selectColumns = sql`
      h.owner_table AS kind,
      h.owner_id AS id,
      r.parent_id AS parent_id,
      COALESCE(p.user_id, r.user_id) AS user_id,
      COALESCE(p.category_id, r.category_id) AS category_id,
      COALESCE(p.language, r.language) AS language,
      COALESCE(p.rhyme_scheme, r.rhyme_scheme) AS rhyme_scheme,
      COALESCE(p.lines, r.lines) AS lines,
      COALESCE(p.status, r.status) AS status,
      COALESCE(p.created_at, r.created_at) AS created_at,
      COALESCE(p.updated_at, r.updated_at) AS updated_at,
      u.username AS username,
      u.display_name AS display_name,
      u.avatar_url AS avatar_url,
      u.deleted_at AS author_deleted_at,
      (SELECT ur.role FROM user_roles ur
        WHERE ur.user_id = u.id
        ORDER BY CASE ur.role
          WHEN 'root' THEN 5 WHEN 'admin' THEN 4 WHEN 'reviewer' THEN 3
          WHEN 'editor' THEN 2 ELSE 1 END DESC
        LIMIT 1) AS user_role,
      h.rank AS rank
    `;

    const fromJoins = sql`
      FROM hits h
      LEFT JOIN pantuns p ON h.owner_table = 'pantun' AND p.id = h.owner_id
      LEFT JOIN pantun_replies r ON h.owner_table = 'reply' AND r.id = h.owner_id
      LEFT JOIN users u ON u.id = COALESCE(p.user_id, r.user_id)
    `;

    const hitsCte = match
      ? sql`WITH hits AS (
          -- row_number dulu (bukan MIN/GROUP BY): bm25() tidak boleh dipakai
          -- di konteks agregat, pola sama fts-word-search-index.ts.
          SELECT owner_table, owner_id, rank FROM (
            SELECT owner_table, owner_id, rank,
              row_number() OVER (PARTITION BY owner_table, owner_id ORDER BY rank) rn
            FROM (
              SELECT owner_table, owner_id, bm25(pantuns_search_fts) AS rank
              FROM pantuns_search_fts WHERE pantuns_search_fts MATCH ${match}
            )
          ) WHERE rn = 1 ORDER BY rank LIMIT ${limit}
        )`
      : // ponytail: term pendek tidak terindeks trigram; LIKE penuh masih
        // benar (tanpa ranking). Ganti bila perlu index token 2 karakter.
        sql`WITH hits AS (
          SELECT 'pantun' AS owner_table, id AS owner_id, 0 AS rank
          FROM pantuns
          WHERE status = 'published' AND lines LIKE ${`%${terms[0]}%`}
          UNION ALL
          SELECT 'reply' AS owner_table, id AS owner_id, 0 AS rank
          FROM pantun_replies
          WHERE status = 'published' AND lines LIKE ${`%${terms[0]}%`}
          ORDER BY owner_id DESC
          LIMIT ${limit}
        )`;

    const rows = await this.db.all<PantunSearchRow>(sql`
      ${hitsCte}
      SELECT ${selectColumns}
      ${fromJoins}
      WHERE p.id IS NOT NULL OR r.id IS NOT NULL
      ORDER BY h.rank
    `);
    return rows.map(toSearchHit);
  }
}
