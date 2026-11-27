import type {
  NewEntityCommentAudioInput,
  NewEntityCommentImageInput,
} from '@/shared/comment/entity-comment-media';
import type { CuisineUsahaAvailability } from '@/shared/database/drizzle/schema/cuisine-usahas.schema';
import type { CuisinePublishStatus } from '@/shared/database/drizzle/schema/cuisines.schema';
import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type {
  Cuisine,
  CuisineComment,
  CuisineDetail,
  CuisineUsahaLink,
  CulinaryCategoryRef,
} from '../entities/culinary.entity';

export interface NewCuisineCommentInput {
  cuisineId: string;
  parentId?: string | null;
  userId: string;
  body: string;
  bodyOriginal: string | null;
  stickerId?: string | null;
  image?: NewEntityCommentImageInput | null;
  audio?: NewEntityCommentAudioInput | null;
}

export interface CuisineCommentListFilter {
  status?: 'published';
  cursor?: string;
  limit: number;
}

export interface CreateCuisineInput {
  id?: string;
  slug: string;
  name: string;
  description?: string | null;
  categoryId?: string | null;
  originRegion?: string | null;
  imagesJson?: string | null;
  ingredientsJson?: string | null;
  servingSuggestion?: string | null;
  tagsJson?: string | null;
  sourcesJson?: string | null;
  license?: string | null;
  publishStatus?: CuisinePublishStatus;
  authorId?: string | null;
}

export interface UpdateCuisineInput {
  id: string;
  slug?: string;
  name?: string;
  description?: string | null;
  categoryId?: string | null;
  originRegion?: string | null;
  imagesJson?: string | null;
  ingredientsJson?: string | null;
  servingSuggestion?: string | null;
  tagsJson?: string | null;
  sourcesJson?: string | null;
  license?: string | null;
  publishStatus?: CuisinePublishStatus;
  /** null = lepas pembatasan. */
  restricted?: { reason: string } | null;
}

export interface ListCuisinesInput {
  limit: number;
  before?: string;
  categoryId?: string;
  q?: string;
  status?: CuisinePublishStatus;
  /** true = hanya published + tidak dihapus (API publik). */
  publicOnly?: boolean;
}

export interface ListResult<T> {
  items: T[];
  nextCursor: string | null;
}

export interface CreateLinkInput {
  id?: string;
  cuisineId: string;
  usahaId: string;
  availability?: CuisineUsahaAvailability;
  note?: string | null;
  publishStatus?: CuisinePublishStatus;
  authorId?: string | null;
}

export interface UpdateLinkInput {
  id: string;
  availability?: CuisineUsahaAvailability;
  note?: string | null;
  publishStatus?: CuisinePublishStatus;
}

export interface CulinaryRepository {
  // -- kuliner --
  createCuisine(input: CreateCuisineInput): Promise<Cuisine>;
  updateCuisine(input: UpdateCuisineInput): Promise<Cuisine | null>;
  softDeleteCuisine(id: string): Promise<boolean>;
  findCuisineById(id: string): Promise<CuisineDetail | null>;
  findCuisineBySlug(
    slug: string,
    opts?: { publicOnly?: boolean },
  ): Promise<CuisineDetail | null>;
  listCuisines(input: ListCuisinesInput): Promise<ListResult<Cuisine>>;
  existingCuisineSlugs(slugs: string[]): Promise<Set<string>>;
  /** Duplikat kandidat nama mirip (normalisasi lowercase-trim, read-only). */
  findCuisineDuplicates(input: {
    q: string;
    excludeId?: string;
  }): Promise<Array<{ id: string; slug: string; name: string }>>;
  // -- relasi kuliner-usaha --
  createLink(input: CreateLinkInput): Promise<CuisineUsahaLink>;
  updateLink(input: UpdateLinkInput): Promise<CuisineUsahaLink | null>;
  softDeleteLink(id: string): Promise<boolean>;
  findLinkById(id: string): Promise<CuisineUsahaLink | null>;
  /** Relasi aktif (belum dihapus) untuk pasangan kuliner-usaha. */
  findLinkByPair(
    cuisineId: string,
    usahaId: string,
  ): Promise<CuisineUsahaLink | null>;
  /** Fase read: daftar relasi published untuk kuliner (JOIN nama usaha). */
  linksForCuisine(cuisineId: string): Promise<CuisineUsahaLink[]>;
  // -- kategori --
  categoryRef(categoryId: string): Promise<CulinaryCategoryRef | null>;
  listCategories(publicOnly: boolean): Promise<CulinaryCategoryRef[]>;
  // --- komentar kuliner ---
  createComment(input: NewCuisineCommentInput): Promise<CuisineComment>;
  findCommentById(id: string): Promise<CuisineComment | null>;
  listComments(
    cuisineId: string,
    filter: CuisineCommentListFilter,
  ): Promise<CursorPage<CuisineComment>>;
  updateCommentWithRevision(input: {
    commentId: string;
    editorId: string;
    body: string;
  }): Promise<CuisineComment | null>;
  markCommentDeletedByAuthor(id: string, actorId: string): Promise<boolean>;
  takedownComment(id: string, actorId: string): Promise<boolean>;
  listCommentRevisions?(commentId: string): Promise<Array<{ editorId: string; body: string; createdAt: Date }>>;
  cuisineTargetExists(id: string): Promise<boolean>;
}
