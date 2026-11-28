import { and, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import { attachCommentRepliesTwoLevel } from '@/shared/comment/comment-threading';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import {
  photoCommentRevisions,
  photoComments,
} from '@/shared/database/drizzle/schema/photo-comments.schema';
import { users } from '@/shared/database/drizzle/schema/users.schema';
import { highestUserRoleSql } from '@/shared/database/highest-user-role-sql';
import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type {
  PhotoComment,
  PhotoCommentKind,
} from '../domain/entities/photo-comment.entity';
import type {
  NewPhotoCommentInput,
  PhotoCommentListFilter,
  PhotoCommentRepository,
} from '../domain/repositories/photo-comment.repository';

const COMMENT_REVISION_CAP = 50;

type PhotoCommentRow = typeof photoComments.$inferSelect;

function toPhotoComment(
  row: PhotoCommentRow,
  meta: {
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    userRole: string | null;
    authorDeletedAt: Date | null;
    isEdited: boolean;
  },
): PhotoComment {
  const deleted = meta.authorDeletedAt !== null;
  return {
    id: row.id,
    photoKind: row.photoKind,
    photoRef: row.photoRef,
    hostId: row.hostId,
    parentId: row.parentId ?? null,
    userId: row.userId,
    username: deleted ? null : meta.username,
    displayName: deleted ? null : meta.displayName,
    avatarUrl: deleted ? null : meta.avatarUrl,
    userRole: deleted ? null : meta.userRole,
    authorDeletedAt: meta.authorDeletedAt,
    body: row.body,
    status: row.status,
    isEdited: meta.isEdited,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
  };
}

export class PhotoCommentRepositoryImpl implements PhotoCommentRepository {
  constructor(private readonly db: AppDatabase) {}

  /** Kolom SELECT bersama: komentar + penulis + flag edit dalam SATU query. */
  private selectWithAuthor() {
    return this.db
      .select({
        c: photoComments,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        authorDeletedAt: users.deletedAt,
        userRole: highestUserRoleSql,
        isEdited: sql<boolean>`EXISTS (
          SELECT 1 FROM ${photoCommentRevisions}
          WHERE ${photoCommentRevisions.commentId} = ${photoComments.id}
        )`,
      })
      .from(photoComments)
      .leftJoin(users, eq(users.id, photoComments.userId));
  }

  private mapRow(row: {
    c: PhotoCommentRow;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    authorDeletedAt: Date | null;
    userRole: string | null;
    isEdited: boolean;
  }): PhotoComment {
    return toPhotoComment(row.c, {
      username: row.username,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      userRole: row.userRole,
      authorDeletedAt: row.authorDeletedAt,
      isEdited: Boolean(row.isEdited),
    });
  }

  async createComment(input: NewPhotoCommentInput): Promise<PhotoComment> {
    const [row] = await this.db
      .insert(photoComments)
      .values({
        photoKind: input.photoKind,
        photoRef: input.photoRef,
        hostId: input.hostId,
        parentId: input.parentId ?? null,
        userId: input.userId,
        body: input.body,
        bodyOriginal: input.bodyOriginal,
        createdAt: new Date(),
      })
      .returning();
    if (!row) throw new Error('gagal menyimpan komentar foto');
    const comment = await this.findCommentById(row.id);
    if (!comment) throw new Error('komentar foto tidak ditemukan setelah dibuat');
    return comment;
  }

  async findCommentById(id: string): Promise<PhotoComment | null> {
    const [row] = await this.selectWithAuthor()
      .where(eq(photoComments.id, id))
      .limit(1);
    return row ? this.mapRow(row) : null;
  }

  async listComments(
    kind: PhotoCommentKind,
    ref: string,
    filter: PhotoCommentListFilter,
  ): Promise<CursorPage<PhotoComment>> {
    const limit = filter.limit;
    const conditions = [
      eq(photoComments.photoKind, kind),
      eq(photoComments.photoRef, ref),
      isNull(photoComments.parentId),
    ];
    if (filter.status) conditions.push(eq(photoComments.status, filter.status));
    if (filter.cursor) conditions.push(lt(photoComments.id, filter.cursor));

    const rows = await this.selectWithAuthor()
      .where(and(...conditions))
      .orderBy(desc(photoComments.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const tops = page.map((row) => this.mapRow(row));
    const topIds = tops.map((t) => t.id);

    let replies: PhotoComment[] = [];
    if (topIds.length > 0) {
      const replyConds = [inArray(photoComments.parentId, topIds)];
      if (filter.status) replyConds.push(eq(photoComments.status, filter.status));
      const replyRows = await this.selectWithAuthor()
        .where(and(...replyConds))
        .orderBy(photoComments.createdAt, photoComments.id);
      replies = replyRows.map((row) => this.mapRow(row));
    }
    return {
      items: attachCommentRepliesTwoLevel(tops, replies),
      nextCursor: hasMore ? (page[page.length - 1]?.c.id ?? null) : null,
      hasMore,
    };
  }

  async updateCommentWithRevision(input: {
    commentId: string;
    editorId: string;
    body: string;
  }): Promise<PhotoComment | null> {
    const now = new Date();
    const updated = await this.db.transaction(async (tx) => {
      const [current] = await tx
        .select({ body: photoComments.body })
        .from(photoComments)
        .where(eq(photoComments.id, input.commentId))
        .limit(1);
      if (!current) return null;

      await tx.insert(photoCommentRevisions).values({
        commentId: input.commentId,
        editorId: input.editorId,
        body: current.body,
        createdAt: now,
      });
      const revisions = await tx
        .select({ id: photoCommentRevisions.id })
        .from(photoCommentRevisions)
        .where(eq(photoCommentRevisions.commentId, input.commentId))
        .orderBy(desc(photoCommentRevisions.createdAt));
      const excess = revisions.slice(COMMENT_REVISION_CAP);
      if (excess.length > 0) {
        await tx
          .delete(photoCommentRevisions)
          .where(inArray(photoCommentRevisions.id, excess.map((r) => r.id)));
      }

      const [row] = await tx
        .update(photoComments)
        .set({ body: input.body, updatedAt: now })
        .where(
          and(
            eq(photoComments.id, input.commentId),
            eq(photoComments.status, 'published'),
            eq(photoComments.userId, input.editorId),
          ),
        )
        .returning({ id: photoComments.id });
      return row?.id ?? null;
    });
    if (!updated) return null;
    return this.findCommentById(updated);
  }

  async markCommentDeletedByAuthor(id: string, actorId: string): Promise<boolean> {
    const [row] = await this.db
      .update(photoComments)
      .set({ status: 'deleted_by_author', deletedAt: new Date() })
      .where(
        and(
          eq(photoComments.id, id),
          eq(photoComments.userId, actorId),
          eq(photoComments.status, 'published'),
        ),
      )
      .returning({ id: photoComments.id });
    return Boolean(row);
  }

  async takedownComment(id: string, actorId: string): Promise<boolean> {
    const [row] = await this.db
      .update(photoComments)
      .set({ status: 'taken_down', reviewedBy: actorId, reviewedAt: new Date() })
      .where(and(eq(photoComments.id, id), eq(photoComments.status, 'published')))
      .returning({ id: photoComments.id });
    return Boolean(row);
  }

  async listCommentRevisions(
    commentId: string,
  ): Promise<Array<{ editorId: string; body: string; createdAt: Date }>> {
    return this.db
      .select({
        editorId: photoCommentRevisions.editorId,
        body: photoCommentRevisions.body,
        createdAt: photoCommentRevisions.createdAt,
      })
      .from(photoCommentRevisions)
      .where(eq(photoCommentRevisions.commentId, commentId))
      .orderBy(
        desc(photoCommentRevisions.createdAt),
        desc(photoCommentRevisions.id),
      );
  }

  async countByPhotos(
    kind: PhotoCommentKind,
    refs: string[],
  ): Promise<Record<string, number>> {
    const unique = [...new Set(refs)];
    if (unique.length === 0) return {};
    const rows = await this.db
      .select({
        ref: photoComments.photoRef,
        n: sql<number>`count(*)`,
      })
      .from(photoComments)
      .where(
        and(
          eq(photoComments.photoKind, kind),
          inArray(photoComments.photoRef, unique),
          eq(photoComments.status, 'published'),
        ),
      )
      .groupBy(photoComments.photoRef);
    const out: Record<string, number> = {};
    for (const row of rows) out[row.ref] = Number(row.n);
    return out;
  }
}
