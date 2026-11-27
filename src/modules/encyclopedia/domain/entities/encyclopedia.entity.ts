import type { CommentAudio } from '@/modules/comment/domain/entities/comment.entity';
import type {
  ArticleCommentStatus,
  ArticleContributionKind,
  ArticleContributionStatus,
  ArticleStatus,
} from '@/shared/database/drizzle/schema/encyclopedia.schema';

export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  bodyMd: string;
  bodyText: string;
  coverUrl: string | null;
  categoryId: string;
  categoryName: string | null;
  sourceUrl: string | null;
  referencesMd: string | null;
  authorUserId: string;
  authorUsername: string | null;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  authorDeletedAt: Date | null;
  /** Role tertinggi penulis (untuk `is_verifier` wire); null bila bukan staf. */
  authorRole: string | null;
  status: ArticleStatus;
  tags: string[];
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface EncyclopediaCategory {
  id: string;
  name: string;
  status: string;
  sortOrder: number;
}

export interface EncyclopediaTag {
  id: string;
  slug: string;
  name: string;
}

/** Payload usulan (versi lengkap yang diusulkan user/admin). */
export interface ArticleRelatedRef {
  kind:
    | 'word'
    | 'article'
    | 'place'
    | 'event'
    | 'usaha'
    | 'karya'
    | 'kreator'
    | 'cuisine'
    | 'layanan';
  id?: string;
  slug?: string;
}

export interface ArticlePayload {
  title: string;
  excerpt: string;
  body_md: string;
  category_id: string;
  tags: string[];
  cover_url?: string | null;
  source_url?: string | null;
  references_md?: string | null;
  related?: ArticleRelatedRef[];
}

export interface ArticleContribution {
  id: string;
  userId: string;
  username: string | null;
  displayName: string | null;
  kind: ArticleContributionKind;
  articleId: string | null;
  articleSlug: string | null;
  articleTitle: string | null;
  payload: ArticlePayload;
  baseUpdatedAt: Date | null;
  status: ArticleContributionStatus;
  resultArticleId: string | null;
  revisionNote: string | null;
  rejectReasonCode: string | null;
  rejectReasonText: string | null;
  createdAt: Date;
  updatedAt: Date | null;
  reviewedAt: Date | null;
}

export interface ArticleRevision {
  id: string;
  articleId: string;
  editorId: string;
  editorUsername: string | null;
  contributionId: string | null;
  title: string;
  excerpt: string;
  bodyMd: string;
  categoryId: string;
  tags: string[];
  changeNote: string | null;
  createdAt: Date;
}

export interface ArticleComment {
  id: string;
  articleId: string;
  parentId: string | null;
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  userRole: string | null;
  authorDeletedAt: Date | null;
  body: string;
  imageUrl: string | null;
  /** Slug katalog stickers; null = bukan komentar stiker. */
  stickerId: string | null;
  audio: CommentAudio | null;
  status: ArticleCommentStatus;
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date | null;
  replies?: ArticleComment[];
}
