import { and, asc, sql, desc, eq, inArray, isNull, lt } from 'drizzle-orm';
import {
  publicAccountDisplayName,
  publicAccountName,
} from '@/shared/constants/deleted-account';
import { commentRevisions, comments, users, words } from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type {
  Comment,
  CommentImage,
  CommentImageStatus,
  CommentRevision,
  CommentStatus,
  CursorPage,
} from '../domain/entities/comment.entity';
import type {
  CommentRepository,
  ListAdminCommentsParams,
  ListCommentsParams,
  ListMyCommentsParams,
} from '../domain/repositories/comment.repository';
import { COMMENT_REVISION_CAP } from '../domain/repositories/comment.repository';

function parseContentWarnings(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
}

function toCommentImage(row: typeof comments.$inferSelect): CommentImage | null {
  const status = row.imageStatus as CommentImageStatus | null;
  if (
    !status ||
    (status !== 'pending_review' && status !== 'published' && status !== 'rejected')
  ) {
    return null;
  }
  if (
    typeof row.imageUrl !== 'string' ||
    row.imageUrl.length === 0 ||
    typeof row.imageProvider !== 'string' ||
    typeof row.imageProviderFileId !== 'string'
  ) {
    // rejected boleh tanpa URL staging
    if (status === 'rejected') {
      return {
        url: row.imageUrl ?? '',
        provider: row.imageProvider ?? '',
        providerFileId: row.imageProviderFileId ?? '',
        publicUrl: null,
        status,
        contentWarnings: parseContentWarnings(row.imageContentWarnings),
        reviewedBy: row.imageReviewedBy ?? null,
        reviewedAt: row.imageReviewedAt ?? null,
      };
    }
    return null;
  }
  return {
    url: row.imageUrl,
    provider: row.imageProvider,
    providerFileId: row.imageProviderFileId,
    publicUrl: row.imagePublicUrl ?? null,
    status,
    contentWarnings: parseContentWarnings(row.imageContentWarnings),
    reviewedBy: row.imageReviewedBy ?? null,
    reviewedAt: row.imageReviewedAt ?? null,
  };
}

const PUBLIC_STATUSES: CommentStatus[] = ['published', 'taken_down', 'deleted_by_author'];

function commentIsEditedSql() {
  return sql<boolean>`exists (select 1 from ${commentRevisions} where ${commentRevisions.commentId} = ${comments.id})`;
}

export class CommentRepositoryImpl implements CommentRepository {
  constructor(private readonly db: AppDatabase) {}

  private selectBase() {
    return this.db
      .select({
        comment: comments,
        isEdited: commentIsEditedSql(),
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        userRole: sql<string | null>`(SELECT ur.role FROM user_roles ur WHERE ur.user_id = ${users.id} ORDER BY CASE ur.role WHEN 'root' THEN 5 WHEN 'admin' THEN 4 WHEN 'reviewer' THEN 3 WHEN 'editor' THEN 2 ELSE 1 END DESC LIMIT 1)`,
        authorDeletedAt: users.deletedAt,
        wordLemma: words.lemma,
      })
      .from(comments)
      .leftJoin(users, eq(users.id, comments.userId))
      .leftJoin(words, eq(words.id, comments.wordId));
  }

  async create(data: {
    wordId: string;
    userId: string;
    body: string;
    bodyOriginal?: string | null;
    audio?: {
      url: string;
      mimeType: string;
      fileSize: number;
      durationMs: number | null;
      provider: string;
      providerFileId: string;
      sha: string | null;
    } | null;
    image?: {
      url: string;
      provider: string;
      providerFileId: string;
    } | null;
  }): Promise<Comment> {
    const audio = data.audio ?? null;
    const image = data.image ?? null;
    const [row] = await this.db
      .insert(comments)
      .values({
        wordId: data.wordId,
        userId: data.userId,
        body: data.body,
        bodyOriginal: data.bodyOriginal ?? null,
        audioUrl: audio?.url ?? null,
        audioMimeType: audio?.mimeType ?? null,
        audioFileSize: audio?.fileSize ?? null,
        audioDurationMs: audio?.durationMs ?? null,
        audioProvider: audio?.provider ?? null,
        audioProviderFileId: audio?.providerFileId ?? null,
        audioSha: audio?.sha ?? null,
        imageUrl: image?.url ?? null,
        imageProvider: image?.provider ?? null,
        imageProviderFileId: image?.providerFileId ?? null,
        imagePublicUrl: null,
        imageStatus: image ? 'pending_review' : null,
        imageContentWarnings: image ? '[]' : null,
        status: 'published',
      })
      .returning();
    const created = await this.findById(row.id);
    if (!created) {
      return this.toComment(row, null, null, null, null, null);
    }
    return created;
  }

  async listByWord(wordId: string, params: ListCommentsParams): Promise<CursorPage<Comment>> {
    const where = and(
      eq(comments.wordId, wordId),
      inArray(comments.status, PUBLIC_STATUSES),
      isNull(comments.deletedAt),
      params.cursor ? lt(comments.id, params.cursor) : undefined,
    );
    return this.page(where, params.limit);
  }

  async findById(id: string): Promise<Comment | null> {
    const [row] = await this.selectBase()
      .where(and(eq(comments.id, id), isNull(comments.deletedAt)))
      .limit(1);
    return row
      ? this.toComment(
          row.comment,
          publicAccountName(row.username, row.authorDeletedAt),
          publicAccountDisplayName(row.displayName, row.username, row.authorDeletedAt),
          row.authorDeletedAt ? null : (row.avatarUrl ?? null),
          row.authorDeletedAt ? null : (row.userRole ?? null),
          row.wordLemma,
          Boolean(row.isEdited),
        )
      : null;
  }

  async softDelete(id: string, actorId: string): Promise<boolean> {
    const updated = await this.db
      .update(comments)
      .set({ deletedAt: new Date(), deletedBy: actorId, updatedAt: new Date() })
      .where(and(eq(comments.id, id), isNull(comments.deletedAt)))
      .returning({ id: comments.id });
    return updated.length > 0;
  }

  async markDeletedByAuthor(id: string, actorId: string): Promise<boolean> {
    const updated = await this.db
      .update(comments)
      .set({
        status: 'deleted_by_author',
        updatedAt: new Date(),
        // track actor in reviewed_* for consistency with moderation trail
        reviewedBy: actorId,
        reviewedAt: new Date(),
      })
      .where(
        and(
          eq(comments.id, id),
          eq(comments.status, 'published'),
          isNull(comments.deletedAt),
        ),
      )
      .returning({ id: comments.id });
    return updated.length > 0;
  }

  async listAdmin(params: ListAdminCommentsParams): Promise<CursorPage<Comment>> {
    const where = and(
      params.status ? eq(comments.status, params.status) : undefined,
      params.wordId ? eq(comments.wordId, params.wordId) : undefined,
      params.imageStatus ? eq(comments.imageStatus, params.imageStatus) : undefined,
      isNull(comments.deletedAt),
      params.cursor ? lt(comments.id, params.cursor) : undefined,
    );
    return this.page(where, params.limit);
  }

  async listByUser(params: ListMyCommentsParams): Promise<CursorPage<Comment>> {
    const where = and(
      eq(comments.userId, params.userId),
      params.status ? eq(comments.status, params.status) : undefined,
      isNull(comments.deletedAt),
      params.cursor ? lt(comments.id, params.cursor) : undefined,
    );
    const rows = await this.db
      .select({
        comment: comments,
        wordLemma: words.lemma,
        wordDeletedAt: words.deletedAt,
      })
      .from(comments)
      .leftJoin(words, eq(words.id, comments.wordId))
      .where(where)
      .orderBy(desc(comments.id))
      .limit(params.limit + 1);

    const hasMore = rows.length > params.limit;
    const page = hasMore ? rows.slice(0, params.limit) : rows;
    let items = page.map((row) =>
      this.toComment(
        row.comment,
        null,
        null,
        null,
        null,
        row.wordDeletedAt ? null : row.wordLemma,
      ),
    );
    items = await this.hydrateIsEdited(items);
    return { items, nextCursor: hasMore ? items[items.length - 1].id : null, hasMore };
  }

  async takedown(id: string, reviewerId: string): Promise<boolean> {
    const updated = await this.db
      .update(comments)
      .set({
        status: 'taken_down',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(comments.id, id), eq(comments.status, 'published'), isNull(comments.deletedAt)),
      )
      .returning({ id: comments.id });
    return updated.length > 0;
  }

  async uncensor(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing?.bodyOriginal) return false;

    const updated = await this.db
      .update(comments)
      .set({
        body: existing.bodyOriginal,
        bodyOriginal: null,
        updatedAt: new Date(),
      })
      .where(and(eq(comments.id, id), isNull(comments.deletedAt)))
      .returning({ id: comments.id });
    return updated.length > 0;
  }

  async updateBodyWithRevision(input: {
    commentId: string;
    editorId: string;
    body: string;
    bodyOriginal: string | null;
  }): Promise<Comment | null> {
    const updatedId = await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(comments)
        .where(
          and(
            eq(comments.id, input.commentId),
            eq(comments.status, 'published'),
            isNull(comments.deletedAt),
          ),
        )
        .limit(1);
      if (!existing) return null;

      const nextOriginal = input.bodyOriginal;
      const sameBody = existing.body === input.body;
      const sameOriginal = (existing.bodyOriginal ?? null) === (nextOriginal ?? null);
      if (sameBody && sameOriginal) {
        return existing.id;
      }

      await tx.insert(commentRevisions).values({
        commentId: input.commentId,
        editorId: input.editorId,
        body: existing.body,
      });

      const stale = await tx
        .select({ id: commentRevisions.id })
        .from(commentRevisions)
        .where(eq(commentRevisions.commentId, input.commentId))
        .orderBy(asc(commentRevisions.createdAt), asc(commentRevisions.id));

      if (stale.length > COMMENT_REVISION_CAP) {
        const drop = stale.slice(0, stale.length - COMMENT_REVISION_CAP);
        for (const row of drop) {
          await tx
            .delete(commentRevisions)
            .where(eq(commentRevisions.id, row.id));
        }
      }

      await tx
        .update(comments)
        .set({
          body: input.body,
          bodyOriginal: nextOriginal,
          updatedAt: new Date(),
        })
        .where(eq(comments.id, input.commentId));

      return input.commentId;
    });

    if (!updatedId) return null;
    return this.findById(updatedId);
  }

  async listRevisions(commentId: string): Promise<CommentRevision[]> {
    const rows = await this.db
      .select()
      .from(commentRevisions)
      .where(eq(commentRevisions.commentId, commentId))
      .orderBy(desc(commentRevisions.createdAt), desc(commentRevisions.id));

    return rows.map((row) => ({
      id: row.id,
      commentId: row.commentId,
      editorId: row.editorId,
      body: row.body,
      createdAt: row.createdAt,
    }));
  }

  async listDistinctCommenterUserIds(wordId: string): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ userId: comments.userId })
      .from(comments)
      .where(
        and(
          eq(comments.wordId, wordId),
          inArray(comments.status, PUBLIC_STATUSES),
          isNull(comments.deletedAt),
        ),
      );
    return rows.map((r) => r.userId);
  }

  async setPendingImage(
    commentId: string,
    image: { url: string; provider: string; providerFileId: string },
  ): Promise<Comment | null> {
    // Izinkan set ulang hanya jika belum ada foto, atau status rejected.
    const updated = await this.db
      .update(comments)
      .set({
        imageUrl: image.url,
        imageProvider: image.provider,
        imageProviderFileId: image.providerFileId,
        imagePublicUrl: null,
        imageStatus: 'pending_review',
        imageContentWarnings: '[]',
        imageReviewedBy: null,
        imageReviewedAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(comments.id, commentId),
          eq(comments.status, 'published'),
          isNull(comments.deletedAt),
          sql`(${comments.imageStatus} IS NULL OR ${comments.imageStatus} = 'rejected')`,
        ),
      )
      .returning({ id: comments.id });
    if (updated.length === 0) return null;
    return this.findById(commentId);
  }

  async approveImage(
    commentId: string,
    input: {
      reviewerId: string;
      publicUrl: string;
      provider: string;
      providerFileId: string;
      contentWarnings: string[];
    },
  ): Promise<Comment | null> {
    const updated = await this.db
      .update(comments)
      .set({
        imageUrl: input.publicUrl,
        imageProvider: input.provider,
        imageProviderFileId: input.providerFileId,
        imagePublicUrl: input.publicUrl,
        imageStatus: 'published',
        imageContentWarnings: JSON.stringify(input.contentWarnings),
        imageReviewedBy: input.reviewerId,
        imageReviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(comments.id, commentId),
          eq(comments.imageStatus, 'pending_review'),
          isNull(comments.deletedAt),
        ),
      )
      .returning({ id: comments.id });
    if (updated.length === 0) return null;
    return this.findById(commentId);
  }

  async rejectImage(commentId: string, reviewerId: string): Promise<Comment | null> {
    const updated = await this.db
      .update(comments)
      .set({
        imageUrl: null,
        imageProvider: null,
        imageProviderFileId: null,
        imagePublicUrl: null,
        imageStatus: 'rejected',
        imageContentWarnings: '[]',
        imageReviewedBy: reviewerId,
        imageReviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(comments.id, commentId),
          eq(comments.imageStatus, 'pending_review'),
          isNull(comments.deletedAt),
        ),
      )
      .returning({ id: comments.id });
    if (updated.length === 0) return null;
    return this.findById(commentId);
  }

  private async page(where: ReturnType<typeof and> | undefined, limit: number): Promise<CursorPage<Comment>> {
    const rows = await this.selectBase()
      .where(where)
      .orderBy(desc(comments.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map((r) =>
      this.toComment(
        r.comment,
        publicAccountName(r.username, r.authorDeletedAt),
        publicAccountDisplayName(r.displayName, r.username, r.authorDeletedAt),
        r.authorDeletedAt ? null : (r.avatarUrl ?? null),
        r.authorDeletedAt ? null : (r.userRole ?? null),
        r.wordLemma,
        Boolean(r.isEdited),
      ),
    );
    return { items, nextCursor: hasMore ? items[items.length - 1].id : null, hasMore };
  }

  private async hydrateIsEdited(items: Comment[]): Promise<Comment[]> {
    if (items.length === 0) return items;
    const ids = items.map((c) => c.id);
    const editedRows = await this.db
      .selectDistinct({ commentId: commentRevisions.commentId })
      .from(commentRevisions)
      .where(inArray(commentRevisions.commentId, ids));
    const edited = new Set(editedRows.map((r) => r.commentId));
    return items.map((c) => ({ ...c, isEdited: edited.has(c.id) }));
  }

  private toComment(
    row: typeof comments.$inferSelect,
    username: string | null,
    displayName: string | null,
    avatarUrl: string | null,
    userRole: string | null,
    wordLemma: string | null,
    isEdited = false,
  ): Comment {
    const hasAudio =
      typeof row.audioUrl === 'string' &&
      row.audioUrl.length > 0 &&
      typeof row.audioMimeType === 'string' &&
      typeof row.audioProvider === 'string' &&
      typeof row.audioProviderFileId === 'string';

    return {
      id: row.id,
      wordId: row.wordId,
      wordLemma,
      userId: row.userId,
      username,
      displayName,
      avatarUrl,
      userRole,
      body: row.body,
      bodyOriginal: row.bodyOriginal ?? null,
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
      image: toCommentImage(row),
      status: row.status as CommentStatus,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt ?? null,
      isEdited,
    };
  }
}
