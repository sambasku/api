import { eq } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import {
  articleComments,
  comments,
  cuisineComments,
  eventComments,
  karyaComments,
  placeComments,
  usahaComments,
} from '@/shared/database/drizzle/schema';
import type { UgcCommentAnchorKind } from '@/shared/database/drizzle/schema/ugc-comment-lemma-links.schema';
import { NotFoundError } from '@/shared/errors/app-error';

export type ResolvedUgcCommentAnchor = {
  body: string;
  authorId: string;
  status: string;
};

export async function resolveUgcCommentAnchor(
  db: AppDatabase,
  input: {
    anchorKind: UgcCommentAnchorKind;
    hostId: string;
    commentId: string;
  },
): Promise<ResolvedUgcCommentAnchor> {
  switch (input.anchorKind) {
    case 'word_comment': {
      const [row] = await db
        .select({
          body: comments.body,
          userId: comments.userId,
          status: comments.status,
          wordId: comments.wordId,
        })
        .from(comments)
        .where(eq(comments.id, input.commentId))
        .limit(1);
      if (!row || row.wordId !== input.hostId) {
        throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
      }
      return {
        body: row.body ?? '',
        authorId: row.userId,
        status: row.status,
      };
    }
    case 'place_comment': {
      const [row] = await db
        .select({
          body: placeComments.body,
          userId: placeComments.userId,
          status: placeComments.status,
          placeId: placeComments.placeId,
        })
        .from(placeComments)
        .where(eq(placeComments.id, input.commentId))
        .limit(1);
      if (!row || row.placeId !== input.hostId) {
        throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
      }
      return {
        body: row.body ?? '',
        authorId: row.userId,
        status: row.status,
      };
    }
    case 'usaha_comment': {
      const [row] = await db
        .select({
          body: usahaComments.body,
          userId: usahaComments.userId,
          status: usahaComments.status,
          usahaId: usahaComments.usahaId,
        })
        .from(usahaComments)
        .where(eq(usahaComments.id, input.commentId))
        .limit(1);
      if (!row || row.usahaId !== input.hostId) {
        throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
      }
      return {
        body: row.body ?? '',
        authorId: row.userId,
        status: row.status,
      };
    }
    case 'cuisine_comment': {
      const [row] = await db
        .select({
          body: cuisineComments.body,
          userId: cuisineComments.userId,
          status: cuisineComments.status,
          cuisineId: cuisineComments.cuisineId,
        })
        .from(cuisineComments)
        .where(eq(cuisineComments.id, input.commentId))
        .limit(1);
      if (!row || row.cuisineId !== input.hostId) {
        throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
      }
      return {
        body: row.body ?? '',
        authorId: row.userId,
        status: row.status,
      };
    }
    case 'event_comment': {
      const [row] = await db
        .select({
          body: eventComments.body,
          userId: eventComments.userId,
          status: eventComments.status,
          eventId: eventComments.eventId,
        })
        .from(eventComments)
        .where(eq(eventComments.id, input.commentId))
        .limit(1);
      if (!row || row.eventId !== input.hostId) {
        throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
      }
      return {
        body: row.body ?? '',
        authorId: row.userId,
        status: row.status,
      };
    }
    case 'karya_comment': {
      const [row] = await db
        .select({
          body: karyaComments.body,
          userId: karyaComments.userId,
          status: karyaComments.status,
          karyaId: karyaComments.karyaId,
        })
        .from(karyaComments)
        .where(eq(karyaComments.id, input.commentId))
        .limit(1);
      if (!row || row.karyaId !== input.hostId) {
        throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
      }
      return {
        body: row.body ?? '',
        authorId: row.userId,
        status: row.status,
      };
    }
    case 'article_comment': {
      const [row] = await db
        .select({
          body: articleComments.body,
          userId: articleComments.userId,
          status: articleComments.status,
          articleId: articleComments.articleId,
        })
        .from(articleComments)
        .where(eq(articleComments.id, input.commentId))
        .limit(1);
      if (!row || row.articleId !== input.hostId) {
        throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
      }
      return {
        body: row.body ?? '',
        authorId: row.userId,
        status: row.status,
      };
    }
    default: {
      const _exhaustive: never = input.anchorKind;
      throw new Error(`anchor tidak dikenal: ${_exhaustive}`);
    }
  }
}

export async function assertCommentPublished(
  resolved: ResolvedUgcCommentAnchor,
): Promise<void> {
  if (resolved.status !== 'published') {
    throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
  }
}