import { and, asc, desc, eq, gt, inArray, lt, or, sql } from 'drizzle-orm';
import { highestUserRoleSql } from '@/shared/database/highest-user-role-sql';
import {
  publicAccountDisplayName,
  publicAccountName,
} from '@/shared/constants/deleted-account';
import {
  discussionReplies,
  discussionReplyRevisions,
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
  DiscussionListOrder,
  DiscussionReply,
  DiscussionReplyAudio,
  DiscussionReplyRevision,
  DiscussionReplyStatus,
  DiscussionStatus,
} from '../domain/entities/discussion.entity';
import { normalizeDiscussionListSort } from '../domain/entities/discussion.entity';
import type { DiscussionRepository } from '../domain/repositories/discussion.repository';

type DiscussionRow = typeof discussions.$inferSelect;
type ReplyRow = typeof discussionReplies.$inferSelect;

const MAX_REPLY_REVISIONS = 50;

function replyIsEditedSql() {
  return sql<boolean>`exists (select 1 from ${discussionReplyRevisions} where ${discussionReplyRevisions.replyId} = ${discussionReplies.id})`;
}

/** Cursor compound: base64url("metric:id") - votes / replies / activity_ms. */
export function encodeCompoundDiscussionCursor(metric: number, id: string): string {
  return Buffer.from(`${metric}:${id}`).toString('base64url');
}

export function decodeCompoundDiscussionCursor(raw: string): { metric: number; id: string } {
  const decoded = Buffer.from(raw, 'base64url').toString('utf8');
  const colon = decoded.indexOf(':');
  if (colon <= 0) throw new Error('INVALID_COMPOUND_CURSOR');
  const metric = Number(decoded.slice(0, colon));
  const id = decoded.slice(colon + 1);
  if (!id || !Number.isFinite(metric)) {
    throw new Error('INVALID_COMPOUND_CURSOR');
  }
  return { metric, id };
}

/** @deprecated pakai encodeCompoundDiscussionCursor */
export function encodePopularDiscussionCursor(upvotes: number, id: string): string {
  return encodeCompoundDiscussionCursor(upvotes, id);
}

/** @deprecated pakai decodeCompoundDiscussionCursor */
export function decodePopularDiscussionCursor(raw: string): { upvotes: number; id: string } {
  const { metric, id } = decodeCompoundDiscussionCursor(raw);
  if (metric < 0) throw new Error('INVALID_POPULAR_CURSOR');
  return { upvotes: metric, id };
}

function asUnixMs(value: Date | number | null | undefined): number | null {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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

function toDiscussionAudio(row: DiscussionRow): Discussion['audio'] {
  const hasAudio =
    typeof row.audioUrl === 'string' &&
    row.audioUrl.length > 0 &&
    typeof row.audioMimeType === 'string' &&
    typeof row.audioProvider === 'string' &&
    typeof row.audioProviderFileId === 'string';
  if (!hasAudio) return null;
  return {
    url: row.audioUrl as string,
    mimeType: row.audioMimeType as string,
    fileSize: row.audioFileSize ?? 0,
    durationMs: row.audioDurationMs ?? null,
    provider: row.audioProvider as string,
    providerFileId: row.audioProviderFileId as string,
    sha: row.audioSha ?? null,
  };
}

function toDiscussion(
  row: DiscussionRow,
  username: string | null,
  displayName: string | null,
  avatarUrl: string | null,
  userRole: string | null = null,
): Discussion {
  return {
    id: row.id,
    userId: row.userId,
    username,
    displayName,
    avatarUrl,
    userRole,
    body: row.body,
    linkUrl: row.linkUrl ?? null,
    images: asImages(row.images),
    audio: toDiscussionAudio(row),
    status: row.status as DiscussionStatus,
    rejectionNote: row.rejectionNote,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt,
    pinnedReplyId: row.pinnedReplyId,
    lastReplyAt: row.lastReplyAt ?? null,
    publishedReplyCount: row.publishedReplyCount ?? 0,
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
): DiscussionReply {
  const hasAudio =
    typeof row.audioUrl === 'string' &&
    row.audioUrl.length > 0 &&
    typeof row.audioMimeType === 'string' &&
    typeof row.audioProvider === 'string' &&
    typeof row.audioProviderFileId === 'string';

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
    audio: hasAudio
      ? {
          url: row.audioUrl as string,
          mimeType: row.audioMimeType as string,
          fileSize: row.audioFileSize ?? 0,
          durationMs: row.audioDurationMs ?? null,
          provider: row.audioProvider as string,
          providerFileId: row.audioProviderFileId as string,
          sha: row.audioSha ?? null,
        }
      : null,
    status: row.status as DiscussionReplyStatus,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isEdited,
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
    return toDiscussion(row, null, null, null);
  }

  async findById(id: string): Promise<Discussion | null> {
    const [row] = await this.db
      .select({
        discussion: discussions,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        userRole: highestUserRoleSql,
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
      row.authorDeletedAt ? null : (row.avatarUrl ?? null),
      row.authorDeletedAt ? null : (row.userRole ?? null),
    );
  }

  async list(filter: DiscussionListFilter): Promise<CursorPage<Discussion>> {
    const { sort, order } = normalizeDiscussionListSort(filter.sort, filter.order);

    // Sort votes/activity/replies hanya untuk feed published publik.
    if (
      filter.status === 'published' &&
      !filter.userId &&
      (sort === 'votes' || sort === 'activity' || sort === 'replies')
    ) {
      if (sort === 'votes') {
        return this.listPublishedByVotes(filter.limit, order, filter.cursor);
      }
      if (sort === 'activity') {
        return this.listPublishedByActivity(filter.limit, order, filter.cursor);
      }
      return this.listPublishedByReplies(filter.limit, order, filter.cursor);
    }

    return this.listByCreated(filter, order);
  }

  private mapDiscussionRows(
    rows: Array<{
      discussion: DiscussionRow;
      username: string | null;
      displayName: string | null;
      avatarUrl: string | null;
      userRole: string | null;
      authorDeletedAt: Date | null;
    }>,
  ): Discussion[] {
    return rows.map((r) =>
      toDiscussion(
        r.discussion,
        publicAccountName(r.username, r.authorDeletedAt),
        publicAccountDisplayName(r.displayName, r.username, r.authorDeletedAt),
        r.authorDeletedAt ? null : (r.avatarUrl ?? null),
        r.authorDeletedAt ? null : (r.userRole ?? null),
      ),
    );
  }

  private async listByCreated(
    filter: DiscussionListFilter,
    order: DiscussionListOrder,
  ): Promise<CursorPage<Discussion>> {
    const idOrder = order === 'asc' ? asc(discussions.id) : desc(discussions.id);
    const cursorClause = filter.cursor
      ? order === 'asc'
        ? gt(discussions.id, filter.cursor)
        : lt(discussions.id, filter.cursor)
      : undefined;

    const rows = await this.db
      .select({
        discussion: discussions,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        userRole: highestUserRoleSql,
        authorDeletedAt: users.deletedAt,
      })
      .from(discussions)
      .leftJoin(users, eq(users.id, discussions.userId))
      .where(
        and(
          filter.status ? eq(discussions.status, filter.status) : undefined,
          filter.userId ? eq(discussions.userId, filter.userId) : undefined,
          cursorClause,
        ),
      )
      .orderBy(idOrder)
      .limit(filter.limit + 1);

    const hasMore = rows.length > filter.limit;
    const page = hasMore ? rows.slice(0, filter.limit) : rows;
    const items = this.mapDiscussionRows(page);
    return {
      items,
      nextCursor: hasMore && items.length > 0 ? items[items.length - 1].id : null,
      hasMore,
    };
  }

  private async listPublishedByVotes(
    limit: number,
    order: DiscussionListOrder,
    cursor?: string,
  ): Promise<CursorPage<Discussion>> {
    const upvoteExpr = sql<number>`coalesce(sum(case when ${votes.value} = 1 then 1 else 0 end), 0)`;

    let cursorMetric: number | null = null;
    let cursorId: string | null = null;
    if (cursor) {
      try {
        const decoded = decodeCompoundDiscussionCursor(cursor);
        cursorMetric = decoded.metric;
        cursorId = decoded.id;
      } catch {
        cursorMetric = null;
        cursorId = null;
      }
    }

    const havingClause =
      cursorMetric != null && cursorId != null
        ? order === 'asc'
          ? sql`(${upvoteExpr} > ${cursorMetric} or (${upvoteExpr} = ${cursorMetric} and ${discussions.id} > ${cursorId}))`
          : sql`(${upvoteExpr} < ${cursorMetric} or (${upvoteExpr} = ${cursorMetric} and ${discussions.id} < ${cursorId}))`
        : undefined;

    const rows = await this.db
      .select({
        discussion: discussions,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        userRole: highestUserRoleSql,
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
      .orderBy(
        order === 'asc' ? asc(upvoteExpr) : desc(upvoteExpr),
        order === 'asc' ? asc(discussions.id) : desc(discussions.id),
      )
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items = this.mapDiscussionRows(page);
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCompoundDiscussionCursor(Number(last.upvotes) || 0, last.discussion.id)
        : null;
    return { items, nextCursor, hasMore };
  }

  private async listPublishedByActivity(
    limit: number,
    order: DiscussionListOrder,
    cursor?: string,
  ): Promise<CursorPage<Discussion>> {
    const activityExpr = sql<number>`coalesce(${discussions.lastReplyAt}, ${discussions.createdAt})`;

    let cursorMetric: number | null = null;
    let cursorId: string | null = null;
    if (cursor) {
      try {
        const decoded = decodeCompoundDiscussionCursor(cursor);
        cursorMetric = decoded.metric;
        cursorId = decoded.id;
      } catch {
        cursorMetric = null;
        cursorId = null;
      }
    }

    const cursorClause =
      cursorMetric != null && cursorId != null
        ? order === 'asc'
          ? or(
              gt(activityExpr, cursorMetric),
              and(eq(activityExpr, cursorMetric), gt(discussions.id, cursorId)),
            )
          : or(
              lt(activityExpr, cursorMetric),
              and(eq(activityExpr, cursorMetric), lt(discussions.id, cursorId)),
            )
        : undefined;

    const rows = await this.db
      .select({
        discussion: discussions,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        userRole: highestUserRoleSql,
        authorDeletedAt: users.deletedAt,
        activityAt: activityExpr,
      })
      .from(discussions)
      .leftJoin(users, eq(users.id, discussions.userId))
      .where(and(eq(discussions.status, 'published'), cursorClause))
      .orderBy(
        order === 'asc' ? asc(activityExpr) : desc(activityExpr),
        order === 'asc' ? asc(discussions.id) : desc(discussions.id),
      )
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items = this.mapDiscussionRows(page);
    const last = page[page.length - 1];
    const activityMs = last ? asUnixMs(last.activityAt as Date | number) : null;
    const nextCursor =
      hasMore && last && activityMs != null
        ? encodeCompoundDiscussionCursor(activityMs, last.discussion.id)
        : null;
    return { items, nextCursor, hasMore };
  }

  private async listPublishedByReplies(
    limit: number,
    order: DiscussionListOrder,
    cursor?: string,
  ): Promise<CursorPage<Discussion>> {
    let cursorMetric: number | null = null;
    let cursorId: string | null = null;
    if (cursor) {
      try {
        const decoded = decodeCompoundDiscussionCursor(cursor);
        cursorMetric = decoded.metric;
        cursorId = decoded.id;
      } catch {
        cursorMetric = null;
        cursorId = null;
      }
    }

    const countCol = discussions.publishedReplyCount;
    const cursorClause =
      cursorMetric != null && cursorId != null
        ? order === 'asc'
          ? or(
              gt(countCol, cursorMetric),
              and(eq(countCol, cursorMetric), gt(discussions.id, cursorId)),
            )
          : or(
              lt(countCol, cursorMetric),
              and(eq(countCol, cursorMetric), lt(discussions.id, cursorId)),
            )
        : undefined;

    const rows = await this.db
      .select({
        discussion: discussions,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        userRole: highestUserRoleSql,
        authorDeletedAt: users.deletedAt,
      })
      .from(discussions)
      .leftJoin(users, eq(users.id, discussions.userId))
      .where(and(eq(discussions.status, 'published'), cursorClause))
      .orderBy(
        order === 'asc' ? asc(countCol) : desc(countCol),
        order === 'asc' ? asc(discussions.id) : desc(discussions.id),
      )
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items = this.mapDiscussionRows(page);
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCompoundDiscussionCursor(
            last.discussion.publishedReplyCount ?? 0,
            last.discussion.id,
          )
        : null;
    return { items, nextCursor, hasMore };
  }

  /** Hitung ulang denorm count + last_reply_at dari balasan published. */
  private async refreshDiscussionReplyStats(discussionId: string): Promise<void> {
    const [agg] = await this.db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
        lastAt: sql<number | null>`max(${discussionReplies.createdAt})`,
      })
      .from(discussionReplies)
      .where(
        and(
          eq(discussionReplies.discussionId, discussionId),
          eq(discussionReplies.status, 'published'),
        ),
      );

    const count = Number(agg?.count) || 0;
    const lastRaw = agg?.lastAt as unknown;
    let lastAt: Date | null = null;
    if (count > 0 && lastRaw != null) {
      if (lastRaw instanceof Date) {
        lastAt = lastRaw;
      } else {
        const n = Number(lastRaw);
        lastAt = Number.isFinite(n) ? new Date(n) : null;
      }
    }

    await this.db
      .update(discussions)
      .set({
        publishedReplyCount: count,
        lastReplyAt: lastAt,
        updatedAt: new Date(),
      })
      .where(eq(discussions.id, discussionId));
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

  async setDiscussionAudio(input: {
    id: string;
    audio: DiscussionReplyAudio;
  }): Promise<Discussion | null> {
    const [row] = await this.db
      .update(discussions)
      .set({
        audioUrl: input.audio.url,
        audioMimeType: input.audio.mimeType,
        audioFileSize: input.audio.fileSize,
        audioDurationMs: input.audio.durationMs,
        audioProvider: input.audio.provider,
        audioProviderFileId: input.audio.providerFileId,
        audioSha: input.audio.sha,
        updatedAt: new Date(),
      })
      .where(eq(discussions.id, input.id))
      .returning();
    if (!row) return null;
    return this.findById(row.id);
  }

  async createReply(input: NewDiscussionReply): Promise<DiscussionReply> {
    const audio = input.audio ?? null;
    const [row] = await this.db
      .insert(discussionReplies)
      .values({
        discussionId: input.discussionId,
        userId: input.userId,
        body: input.body,
        bodyOriginal: input.bodyOriginal ?? null,
        audioUrl: audio?.url ?? null,
        audioMimeType: audio?.mimeType ?? null,
        audioFileSize: audio?.fileSize ?? null,
        audioDurationMs: audio?.durationMs ?? null,
        audioProvider: audio?.provider ?? null,
        audioProviderFileId: audio?.providerFileId ?? null,
        audioSha: audio?.sha ?? null,
        status: 'published',
      })
      .returning();

    // Denorm #204: naikkan count + last_reply_at (hot path, tanpa full refresh).
    await this.db
      .update(discussions)
      .set({
        publishedReplyCount: sql`${discussions.publishedReplyCount} + 1`,
        lastReplyAt: row.createdAt,
        updatedAt: new Date(),
      })
      .where(eq(discussions.id, input.discussionId));

    return toReply(row, null, null, null, null, false);
  }

  async findReplyById(id: string): Promise<DiscussionReply | null> {
    const [row] = await this.db
      .select({
        reply: discussionReplies,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        userRole: highestUserRoleSql,
        authorDeletedAt: users.deletedAt,
        isEdited: replyIsEditedSql(),
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
      Boolean(row.isEdited),
    );
  }

  async listReplies(discussionId: string): Promise<DiscussionReply[]> {
    const rows = await this.db
      .select({
        reply: discussionReplies,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        userRole: highestUserRoleSql,
        authorDeletedAt: users.deletedAt,
        isEdited: replyIsEditedSql(),
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
        Boolean(r.isEdited),
      ),
    );
  }

  async countPublishedRepliesByDiscussionIds(
    discussionIds: string[],
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (discussionIds.length === 0) return out;

    const rows = await this.db
      .select({
        discussionId: discussionReplies.discussionId,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(discussionReplies)
      .where(
        and(
          inArray(discussionReplies.discussionId, discussionIds),
          eq(discussionReplies.status, 'published'),
        ),
      )
      .groupBy(discussionReplies.discussionId);

    for (const row of rows) {
      out.set(row.discussionId, Number(row.count) || 0);
    }
    return out;
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
      .returning({
        id: discussionReplies.id,
        discussionId: discussionReplies.discussionId,
      });
    if (updated.length === 0) return false;
    await this.refreshDiscussionReplyStats(updated[0].discussionId);
    return true;
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
      .returning({
        id: discussionReplies.id,
        discussionId: discussionReplies.discussionId,
      });
    if (updated.length === 0) return false;
    await this.refreshDiscussionReplyStats(updated[0].discussionId);
    return true;
  }


  async updateReplyBodyWithRevision(input: {
    replyId: string;
    editorId: string;
    body: string;
    bodyOriginal: string | null;
  }): Promise<DiscussionReply | null> {
    const updatedId = await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(discussionReplies)
        .where(
          and(
            eq(discussionReplies.id, input.replyId),
            eq(discussionReplies.status, 'published'),
          ),
        )
        .limit(1);
      if (!existing) return null;

      const nextOriginal = input.bodyOriginal;
      const sameBody = existing.body === input.body;
      const sameOriginal =
        (existing.bodyOriginal ?? null) === (nextOriginal ?? null);
      if (sameBody && sameOriginal) {
        return existing.id;
      }

      await tx.insert(discussionReplyRevisions).values({
        replyId: input.replyId,
        editorId: input.editorId,
        body: existing.body,
      });

      const stale = await tx
        .select({ id: discussionReplyRevisions.id })
        .from(discussionReplyRevisions)
        .where(eq(discussionReplyRevisions.replyId, input.replyId))
        .orderBy(asc(discussionReplyRevisions.createdAt), asc(discussionReplyRevisions.id));

      if (stale.length > MAX_REPLY_REVISIONS) {
        const drop = stale.slice(0, stale.length - MAX_REPLY_REVISIONS);
        for (const row of drop) {
          await tx
            .delete(discussionReplyRevisions)
            .where(eq(discussionReplyRevisions.id, row.id));
        }
      }

      await tx
        .update(discussionReplies)
        .set({
          body: input.body,
          bodyOriginal: nextOriginal,
          updatedAt: new Date(),
        })
        .where(eq(discussionReplies.id, input.replyId));

      return input.replyId;
    });

    if (!updatedId) return null;
    return this.findReplyById(updatedId);
  }

  async listReplyRevisions(replyId: string): Promise<DiscussionReplyRevision[]> {
    const rows = await this.db
      .select()
      .from(discussionReplyRevisions)
      .where(eq(discussionReplyRevisions.replyId, replyId))
      .orderBy(desc(discussionReplyRevisions.createdAt), desc(discussionReplyRevisions.id));

    return rows.map((row) => ({
      id: row.id,
      replyId: row.replyId,
      editorId: row.editorId,
      body: row.body,
      createdAt: row.createdAt,
    }));
  }

}
