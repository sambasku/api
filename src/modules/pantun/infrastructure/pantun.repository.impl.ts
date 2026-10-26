import { and, asc, desc, eq, lt, sql } from 'drizzle-orm';
import { highestUserRoleSql } from '@/shared/database/highest-user-role-sql';
import {
  publicAccountDisplayName,
  publicAccountName,
} from '@/shared/constants/deleted-account';
import { pantuns, pantunReplies, users } from '@/shared/database/drizzle/schema';
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
} from '../domain/entities/pantun.entity';
import type { PantunRepository } from '../domain/repositories/pantun.repository';

type PantunRow = typeof pantuns.$inferSelect;
type ReplyRow = typeof pantunReplies.$inferSelect;

function toLines(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map((x) => String(x)) : [];
}

export type PantunSearchHit =
  | { kind: 'pantun'; pantun: Pantun }
  | { kind: 'reply'; reply: PantunReply };

/** Term FTS trigram minimal 3 karakter; lebih pendek dilewati (kata pendek "ikan" tetap 3). */
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
      ),
    );
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
}
