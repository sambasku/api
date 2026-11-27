import type {
  CommentAudio,
  CommentImage,
} from '@/modules/comment/domain/entities/comment.entity';
import type {
  NewEntityCommentAudioInput,
  NewEntityCommentImageInput,
} from '@/shared/comment/entity-comment-media';
import type { KaryaCommentStatus } from '@/shared/database/drizzle/schema/karya-comments.schema';
import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';

export interface KaryaComment {
  id: string;
  karyaId: string;
  parentId?: string | null;
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  userRole: string | null;
  authorDeletedAt: Date | null;
  body: string;
  stickerId: string | null;
  audio: CommentAudio | null;
  image: CommentImage | null;
  status: KaryaCommentStatus;
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date | null;
  replies?: KaryaComment[];
}

export interface NewKaryaCommentInput {
  karyaId: string;
  parentId?: string | null;
  userId: string;
  body: string;
  bodyOriginal: string | null;
  stickerId?: string | null;
  image?: NewEntityCommentImageInput | null;
  audio?: NewEntityCommentAudioInput | null;
}

export interface KaryaCommentListFilter {
  status?: 'published';
  cursor?: string;
  limit: number;
}

/** Kontrak komentar karya; diimplementasi `KaryaRepositoryImpl`. */
export interface KaryaCommentRepository {
  createComment(input: NewKaryaCommentInput): Promise<KaryaComment>;
  findCommentById(id: string): Promise<KaryaComment | null>;
  listComments(
    karyaId: string,
    filter: KaryaCommentListFilter,
  ): Promise<CursorPage<KaryaComment>>;
  updateCommentWithRevision(input: {
    commentId: string;
    editorId: string;
    body: string;
  }): Promise<KaryaComment | null>;
  markCommentDeletedByAuthor(id: string, actorId: string): Promise<boolean>;
  takedownComment(id: string, actorId: string): Promise<boolean>;
  listCommentRevisions?(commentId: string): Promise<Array<{ editorId: string; body: string; createdAt: Date }>>;
  /** Cek karya masih published (dipakai use case sebelum create comment). */
  karyaTargetExists(id: string): Promise<boolean>;
}
