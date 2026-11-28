import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type {
  PhotoComment,
  PhotoCommentKind,
  PhotoCommentStatus,
  ResolvedPhoto,
} from '../entities/photo-comment.entity';

export interface NewPhotoCommentInput {
  photoKind: PhotoCommentKind;
  photoRef: string;
  hostId: string;
  parentId?: string | null;
  userId: string;
  body: string;
  bodyOriginal: string | null;
}

export interface PhotoCommentListFilter {
  status?: PhotoCommentStatus;
  cursor?: string;
  limit: number;
}

export interface PhotoCommentRepository {
  createComment(input: NewPhotoCommentInput): Promise<PhotoComment>;
  findCommentById(id: string): Promise<PhotoComment | null>;
  listComments(
    kind: PhotoCommentKind,
    ref: string,
    filter: PhotoCommentListFilter,
  ): Promise<CursorPage<PhotoComment>>;
  updateCommentWithRevision(input: {
    commentId: string;
    editorId: string;
    body: string;
  }): Promise<PhotoComment | null>;
  markCommentDeletedByAuthor(id: string, actorId: string): Promise<boolean>;
  takedownComment(id: string, actorId: string): Promise<boolean>;
  listCommentRevisions(
    commentId: string,
  ): Promise<Array<{ editorId: string; body: string; createdAt: Date }>>;
  /** Satu query: jumlah komentar published (top-level + balasan) per ref. */
  countByPhotos(
    kind: PhotoCommentKind,
    refs: string[],
  ): Promise<Record<string, number>>;
}

/** Resolve foto UGC per jenis: host, status tayang, dan pengunggah. */
export interface PhotoResolver {
  resolve(kind: PhotoCommentKind, ref: string): Promise<ResolvedPhoto | null>;
}
