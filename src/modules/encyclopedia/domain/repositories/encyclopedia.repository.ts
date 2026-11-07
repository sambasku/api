import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type {
  Article,
  ArticleComment,
  ArticleContribution,
  ArticlePayload,
  ArticleRevision,
  EncyclopediaCategory,
  EncyclopediaTag,
} from '../entities/encyclopedia.entity';

export interface ArticleListFilter {
  status?: 'published';
  categoryId?: string;
  /** Slug tag (multi, OR). */
  tags?: string[];
  q?: string;
  cursor?: string;
  limit: number;
}

export interface ArticleCommentListFilter {
  status?: 'published';
  cursor?: string;
  limit: number;
}

export interface ContributionListFilter {
  userId?: string;
  status?: 'pending' | 'needs_revision' | 'approved' | 'rejected';
  cursor?: string;
  limit: number;
}

export interface NewArticleInput {
  slug: string;
  title: string;
  excerpt: string;
  bodyMd: string;
  bodyText: string;
  categoryId: string;
  tags: string[];
  coverUrl?: string | null;
  sourceUrl?: string | null;
  referencesMd?: string | null;
  authorUserId: string;
  status: 'draft' | 'published';
}

export interface UpdateArticleInput {
  title?: string;
  excerpt?: string;
  bodyMd?: string;
  bodyText?: string;
  categoryId?: string;
  tags?: string[];
  coverUrl?: string | null;
  sourceUrl?: string | null;
  referencesMd?: string | null;
  status?: 'draft' | 'published' | 'archived';
}

export interface NewArticleCommentInput {
  articleId: string;
  userId: string;
  /** Body pasca-blocklist. */
  body: string;
  /** Body asli; null = tidak disensor. */
  bodyOriginal: string | null;
  imageUrl?: string | null;
}

export interface NewArticleContributionInput {
  userId: string;
  kind: 'new' | 'edit';
  articleId: string | null;
  payload: ArticlePayload;
  baseUpdatedAt: Date | null;
}

export interface NewRevisionInput {
  articleId: string;
  editorId: string;
  contributionId: string | null;
  previous: {
    title: string;
    excerpt: string;
    bodyMd: string;
    categoryId: string;
    tags: string[];
  };
  changeNote: string | null;
}

export interface ArticleRepository {
  // --- artikel ---
  create(input: NewArticleInput): Promise<Article>;
  findById(id: string): Promise<Article | null>;
  findBySlug(slug: string): Promise<Article | null>;
  list(filter: ArticleListFilter): Promise<CursorPage<Article>>;
  /**
   * Update + snapshot revisi (previous) dalam SATU panggilan - repo yang
   * menulis `article_revisions` supaya atomic dan cap 50 dijaga di satu tempat.
   * `changed=false` (tidak ada beda) = tidak update, tidak revisi.
   */
  updateWithRevision(input: {
    id: string;
    patch: UpdateArticleInput;
    revision: NewRevisionInput;
  }): Promise<Article | null>;
  setStatus(id: string, status: 'draft' | 'published' | 'archived', actorId: string): Promise<Article | null>;
  markDeleted(id: string): Promise<boolean>;
  /** Hapus FTS saat artikel dihapus hard (tidak ada trigger cascade ke virtual table). */
  deleteHard(id: string): Promise<boolean>;
  searchPublished(q: string, limit: number): Promise<Article[]>;
  listCategories(): Promise<EncyclopediaCategory[]>;
  createCategory(input: { id: string; name: string; sortOrder: number }): Promise<EncyclopediaCategory>;
  updateCategory(id: string, patch: { name?: string; status?: 'draft' | 'published' | 'archived'; sortOrder?: number }): Promise<EncyclopediaCategory | null>;
  listTags(q: string | undefined, limit: number): Promise<EncyclopediaTag[]>;
  /** Resolve nama tag -> tag existing (by slug), buat yang belum ada. Return map slug->tag. */
  ensureTags(slugs: string[]): Promise<Map<string, EncyclopediaTag>>;
  setArticleTags(articleId: string, tagIds: string[]): Promise<void>;
  renameTag(tagId: string, name: string): Promise<EncyclopediaTag | null>;
  /** Merge tag: pindahkan junction ke target, hapus tag lama. 1 transaksi. */
  mergeTag(fromTagId: string, intoTagId: string): Promise<void>;

  // --- revisi ---
  listRevisions(articleId: string): Promise<ArticleRevision[]>;
  findRevision(articleId: string, revisionId: string): Promise<ArticleRevision | null>;

  // --- komentar ---
  createComment(input: NewArticleCommentInput): Promise<ArticleComment>;
  findCommentById(id: string): Promise<ArticleComment | null>;
  listComments(articleId: string, filter: ArticleCommentListFilter): Promise<CursorPage<ArticleComment>>;
  updateCommentWithRevision(input: {
    commentId: string;
    editorId: string;
    body: string;
  }): Promise<ArticleComment | null>;
  markCommentDeletedByAuthor(id: string, actorId: string): Promise<boolean>;
  takedownComment(id: string, actorId: string): Promise<boolean>;
  /** Resolve wordId induk tidak relevan untuk artikel; targetExists vote perlu ini. */
  commentTargetExists(id: string): Promise<boolean>;
  articleTargetExists(id: string): Promise<boolean>;

  // --- bookmark ---
  toggleBookmark(userId: string, articleId: string): Promise<boolean>;
  /** True bila user sudah bookmark artikel (read-path detail). */
  isBookmarked(userId: string, articleId: string): Promise<boolean>;

  // --- kontribusi ---
  createContribution(input: NewArticleContributionInput): Promise<ArticleContribution>;
  findContributionById(id: string): Promise<ArticleContribution | null>;
  listContributions(filter: ContributionListFilter): Promise<CursorPage<ArticleContribution>>;
  setContributionStatus(input: {
    id: string;
    status: 'pending' | 'needs_revision' | 'approved' | 'rejected';
    revisionNote?: string | null;
    rejectReasonCode?: string | null;
    rejectReasonText?: string | null;
    resultArticleId?: string | null;
  }): Promise<ArticleContribution | null>;
  /** Kosongkan posisi usulan edit aktif (setelah approve/reject) supaya index partial bebas. */
  clearActiveEdit(articleId: string, userId: string): Promise<void>;
  /** Ada usulan edit aktif lain (user lain) di artikel ini? */
  hasActiveEditByOthers(articleId: string, userId: string): Promise<boolean>;
}
