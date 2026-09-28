import { and, asc, desc, eq, lt, sql } from 'drizzle-orm';
import {
  publicAccountDisplayName,
  publicAccountName,
} from '@/shared/constants/deleted-account';
import {
  discussionReplies,
  discussions,
  users,
  votes,
} from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type { DiscussionImageRow } from '@/shared/database/drizzle/schema/discussions.schema';
import { IMAGE_CONTENT_WARNING_SET } from '@/shared/constants/image-content-warnings';
import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type {
  NewDiscussion,
  NewDiscussionReply,
  Discussion,
  DiscussionImage,
  DiscussionListFilter,
  DiscussionReply,
  DiscussionReplyStatus,
  DiscussionStatus,
} from '../domain/entities/discussion.entity';
import type { DiscussionRepository } from '../domain/repositories/discussion.repository';

type DiscussionRow = typeof discussions.$inferSelect;
type ReplyRow = typeof discussionReplies.$inferSelect;

/** Cursor sort popular: base64url("upvotes:id"). */
export function encodePopularDiscussionCursor(upvotes: number, id: string): string {
  return Buffer.from(`${upvotes}:${id}`).toString('base64url');
}

export function decodePopularDiscussionCursor(raw: string): { upvotes: number; id: string } {
  const decoded = Buffer.from(raw, 'base64url').toString('utf8');
  const [upRaw, id] = decoded.split(':');
  const upvotes = Number(upRaw);
  if (!id || !Number.isFinite(upvotes) || upvotes < 0) {
    throw new Error('INVALID_POPULAR_CURSOR');
  }
  return { upvotes, id };
}

function normalizeContentWarnings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is string => typeof x === 'string' && IMAGE_CONTENT_WARNING_SET.has(x),
  );
}

function asImages(value: unknown): DiscussionImage[] {
  if (!Array.isArray(value)) return [];
  return (value as DiscussionImageRow[]).map((item) => ({
    url: item.url,
    providerFileId: item.provider_file_id,
    publicUrl: item.public_url ?? null,
    contentWarnings: normalizeContentWarnings(item.content_warnings),
  }));
}

function toImageRows(images: DiscussionImage[]): DiscussionImageRow[] {
  return images.map((img) => ({
    url: img.url,
    provider_file_id: img.providerFileId,
    public_url: img.publicUrl,
    content_warnings: img.contentWarnings ?? [],
  }));
}

function toDiscussion(
  row: DiscussionRow,
  username: string | null,
  displayName: string | null,
): Discussion {
  return {
    id: row.id,
    userId: row.userId,
    username,
    displayName,
    body: row.body,
    linkUrl: row.linkUrl ?? null,
    images: asImages(row.images),
    status: row.status as DiscussionStatus,
    rejectionNote: row.rejectionNote,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt,
    pinnedReplyId: row.pinnedReplyId,
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
): DiscussionReply {
  return {
    id: row.id,
    discussionId: row.discussionId,
    userId: row.userId,
    username,
    displayName,
    avatarUrl,
    userRole,
    body: row.body,
    bodyOriginal: row.bodyOriginal,
    status: row.status as DiscussionReplyStatus,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DiscussionRepositoryImpl implements DiscussionRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: NewDiscussion): Promise<Discussion> {
    const [row] = await this.db
      .insert(discussions)
      .values({
        userId: input.userId,
        body: input.body,
        linkUrl: input.linkUrl ?? null,
        images: toImageRows(input.images),
        status: 'pending_review',
      })
      .returning();
    return toDiscussion(row, null, null);
  }

  async findById(id: string): Promise<Discussion | null> {
    const [row] = await this.db
      .select({
        discussion: discussions,
        username: users.username,
        displayName: users.displayName,
        authorDeletedAt: users.deletedAt,
      })
      .from(discussions)
      .leftJoin(users, eq(users.id, discussions.userId))
      .where(eq(discussions.id, id))
      .limit(1);
    if (!row) return null;
    return toDiscussion(
      row.discussion,
      publicAccountName(row.username, row.authorDeletedAt),
      publicAccountDisplayName(row.displayName, row.username, row.authorDeletedAt),
    );
  }

  async list(filter: DiscussionListFilter): Promise<CursorPage<Discussion>> {
    if (filter.sort === 'popular' && filter.status === 'published' && !filter.userId) {
      return this.listPublishedPopular(filter.limit, filter.cursor);
    }

    const rows = await this.db
      .select({
        discussion: discussions,
        username: users.username,
        displayName: users.displayName,
        authorDeletedAt: users.deletedAt,
      })
      .from(discussions)
      .leftJoin(users, eq(users.id, discussions.userId))
      .where(
        and(
          filter.status ? eq(discussions.status, filter.status) : undefined,
          filter.userId ? eq(discussions.userId, filter.userId) : undefined,
          filter.cursor ? lt(discussions.id, filter.cursor) : undefined,
        ),
      )
      .orderBy(desc(discussions.id))
      .limit(filter.limit + 1);

    const hasMore = rows.length > filter.limit;
    const page = hasMore ? rows.slice(0, filter.limit) : rows;
    const items = page.map((r) =>
      toDiscussion(
        r.discussion,
        publicAccountName(r.username, r.authorDeletedAt),
        publicAccountDisplayName(r.displayName, r.username, r.authorDeletedAt),
      ),
    );
    return {
      items,
      nextCursor: hasMore && items.length > 0 ? items[items.length - 1].id : null,
      hasMore,
    };
  }

  private async listPublishedPopular(
    limit: number,
    cursor?: string,
  ): Promise<CursorPage<Discussion>> {
    const upvoteExpr = sql<number>`coalesce(sum(case when ${votes.value} = 1 then 1 else 0 end), 0)`;

    let cursorUp: number | null = null;
    let cursorId: string | null = null;
    if (cursor) {
      try {
        const decoded = decodePopularDiscussionCursor(cursor);
        cursorUp = decoded.upvotes;
        cursorId = decoded.id;
      } catch {
        cursorUp = null;
        cursorId = null;
      }
    }

    // Agregat tidak boleh di WHERE - cursor popular memakai HAVING.
    const havingClause =
      cursorUp != null && cursorId != null
        ? sql`(${upvoteExpr} < ${cursorUp} or (${upvoteExpr} = ${cursorUp} and ${discussions.id} < ${cursorId}))`
        : undefined;

    const rows = await this.db
      .select({
        discussion: discussions,
        username: users.username,
        displayName: users.displayName,
        authorDeletedAt: users.deletedAt,
        upvotes: upvoteExpr,
      })
      .from(discussions)
      .leftJoin(users, eq(users.id, discussions.userId))
      .leftJoin(
        votes,
        and(eq(votes.entityType, 'discussion'), eq(votes.entityId, discussions.id)),
      )
      .where(eq(discussions.status, 'published'))
      .groupBy(discussions.id)
      .having(havingClause)
      .orderBy(desc(upvoteExpr), desc(discussions.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items = page.map((r) =>
      toDiscussion(
        r.discussion,
        publicAccountName(r.username, r.authorDeletedAt),
        publicAccountDisplayName(r.displayName, r.username, r.authorDeletedAt),
      ),
    );

    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? encodePopularDiscussionCursor(Number(last.upvotes) || 0, last.discussion.id)
        : null;

    return { items, nextCursor, hasMore };
  }

  async updateStatus(input: {
    id: string;
    fromStatus: DiscussionStatus;
    toStatus: DiscussionStatus;
    actorId: string;
    rejectionNote?: string | null;
    images?: DiscussionImage[];
  }): Promise<Discussion | null> {
    const [row] = await this.db
      .update(discussions)
      .set({
        status: input.toStatus,
        rejectionNote: input.rejectionNote !== undefined ? input.rejectionNote : undefined,
        images: input.images ? toImageRows(input.images) : undefined,
        reviewedBy: input.actorId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(discussions.id, input.id), eq(discussions.status, input.fromStatus)))
      .returning();
    if (!row) return null;
    return this.findById(row.id);
  }

  async setPinnedReply(input: {
    discussionId: string;
    replyId: string | null;
    actorId: string;
  }): Promise<Discussion | null> {
    const [row] = await this.db
      .update(discussions)
      .set({
        pinnedReplyId: input.replyId,
        updatedAt: new Date(),
      })
      .where(eq(discussions.id, input.discussionId))
      .returning();
    if (!row) return null;
    void input.actorId;
    return this.findById(row.id);
  }

  async createReply(input: NewDiscussionReply): Promise<DiscussionReply> {
    const [row] = await this.db
      .insert(discussionReplies)
      .values({
        discussionId: input.discussionId,
        userId: input.userId,
        body: input.body,
        bodyOriginal: input.bodyOriginal ?? null,
        status: 'published',
      })
      .returning();
    return toReply(row, null, null, null, null);
  }

  async findReplyById(id: string): Promise<DiscussionReply | null> {
    const [row] = await this.db
      .select({
        reply: discussionReplies,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        userRole: users.role,
        authorDeletedAt: users.deletedAt,
      })
      .from(discussionReplies)
      .leftJoin(users, eq(users.id, discussionReplies.userId))
      .where(eq(discussionReplies.id, id))
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

  async listReplies(discussionId: string): Promise<DiscussionReply[]> {
    const rows = await this.db
      .select({
        reply: discussionReplies,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        userRole: users.role,
        authorDeletedAt: users.deletedAt,
      })
      .from(discussionReplies)
      .leftJoin(users, eq(users.id, discussionReplies.userId))
      .where(eq(discussionReplies.discussionId, discussionId))
      .orderBy(asc(discussionReplies.createdAt), asc(discussionReplies.id));

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

  async listDistinctReplierUserIds(discussionId: string): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ userId: discussionReplies.userId })
      .from(discussionReplies)
      .where(eq(discussionReplies.discussionId, discussionId));
    return rows.map((r) => r.userId);
  }

  async markReplyDeletedByAuthor(id: string, actorId: string): Promise<boolean> {
    const updated = await this.db
      .update(discussionReplies)
      .set({
        status: 'deleted_by_author',
        reviewedBy: actorId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(discussionReplies.id, id),
          eq(discussionReplies.status, 'published'),
          eq(discussionReplies.userId, actorId),
        ),
      )
      .returning({ id: discussionReplies.id });
    return updated.length > 0;
  }

  async takedownReply(id: string, reviewerId: string): Promise<boolean> {
    const updated = await this.db
      .update(discussionReplies)
      .set({
        status: 'taken_down',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(discussionReplies.id, id),
          eq(discussionReplies.status, 'published'),
        ),
      )
      .returning({ id: discussionReplies.id });
    return updated.length > 0;
  }
}
