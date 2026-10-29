import type {
  Comment,
  CommentImageStatus,
  CommentRevision,
  CursorPage,
  NewComment,
} from '../entities/comment.entity';

/** Maks snapshot revisi per komentar (hapus yang paling lama). */
export const COMMENT_REVISION_CAP = 50;

export interface ListCommentsParams {
  limit: number;
  cursor?: string;
}

export interface ListAdminCommentsParams extends ListCommentsParams {
  /** absen = semua status (embed detail kata); antrean mengirim eksplisit */
  status?: Comment['status'];
  /** filter komentar satu kata (section komentar di detail admin) */
  wordId?: string;
  /** Antrean foto: filter image_status (mis. pending_review). */
  imageStatus?: CommentImageStatus;
}

export interface ListMyCommentsParams extends ListCommentsParams {
  userId: string;
  status?: Comment['status'];
}

// Kontrak repository modul comment (09-api-comment.md). Soft-delete
// (deleted_at) hanya purge keras; list publik memfilter isNull(deletedAt).
export interface CommentRepository {
  create(data: NewComment): Promise<Comment>;

  /**
   * Komentar tayang pada sebuah kata: published | taken_down |
   * deleted_by_author, urut terbaru (id DESC), cursor pagination.
   */
  listByWord(wordId: string, params: ListCommentsParams): Promise<CursorPage<Comment>>;

  /** By id, belum soft-deleted (semua status - untuk delete & takedown). */
  findById(id: string): Promise<Comment | null>;

  softDelete(id: string, actorId: string): Promise<boolean>;

  markDeletedByAuthor(id: string, actorId: string): Promise<boolean>;

  listAdmin(params: ListAdminCommentsParams): Promise<CursorPage<Comment>>;

  listByUser(params: ListMyCommentsParams): Promise<CursorPage<Comment>>;

  takedown(id: string, reviewerId: string): Promise<boolean>;

  /**
   * Pulihkan teks asli: body = body_original, body_original = null.
   * WHERE body_original IS NOT NULL AND deleted_at IS NULL.
   */
  uncensor(id: string): Promise<boolean>;

  /**
   * User distinct yang punya komentar tampil publik pada kata ini
   * (status published | taken_down | deleted_by_author, belum soft-delete).
   */
  listDistinctCommenterUserIds(wordId: string): Promise<string[]>;

  updateBodyWithRevision(input: {
    commentId: string;
    editorId: string;
    body: string;
    bodyOriginal: string | null;
  }): Promise<Comment | null>;

  listRevisions(commentId: string): Promise<CommentRevision[]>;

  /**
   * Lampirkan / ganti foto staging pada komentar published.
   * Atomic: hanya jika belum ada pending/published, atau allowReplace.
   */
  setPendingImage(
    commentId: string,
    image: { url: string; provider: string; providerFileId: string },
  ): Promise<Comment | null>;

  /** Promote foto: pending_review → published + public URL. */
  approveImage(
    commentId: string,
    input: {
      reviewerId: string;
      publicUrl: string;
      provider: string;
      providerFileId: string;
      contentWarnings: string[];
    },
  ): Promise<Comment | null>;

  /** Tolak foto: pending_review → rejected; bersihkan URL staging di DB. */
  rejectImage(commentId: string, reviewerId: string): Promise<Comment | null>;
}
