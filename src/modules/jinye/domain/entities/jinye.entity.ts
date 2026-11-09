import type {
  JinyeCommentStatus,
  JinyeImageRow,
  JinyeStatus,
} from '@/shared/database/drizzle/schema/jinye.schema';
import type {
  JinyeLemmaLinkSource,
  JinyeLemmaLinkStatus,
} from '@/shared/database/drizzle/schema/jinye-lemma-links.schema';

export type JinyeImage = {
  url: string;
  providerFileId: string;
  publicUrl: string | null;
  contentWarnings: string[];
};

export type JinyeAudio = {
  url: string;
  mimeType: string;
  fileSize: number;
  durationMs: number | null;
  provider: string;
  providerFileId: string;
  sha: string | null;
};

export interface Jinye {
  id: string;
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  userRole: string | null;
  body: string;
  bodyOriginal: string | null;
  images: JinyeImage[];
  audio: JinyeAudio | null;
  repostOfId: string | null;
  quoteBody: string | null;
  status: JinyeStatus;
  publishedCommentCount: number;
  repostCount: number;
  createdAt: Date;
  updatedAt: Date | null;
  isEdited?: boolean;
}

export interface NewJinye {
  userId: string;
  body: string;
  bodyOriginal?: string | null;
  images: JinyeImage[];
  audio?: JinyeAudio | null;
  id?: string;
}

export interface JinyeListFilter {
  limit: number;
  cursor?: string;
  userId?: string;
  /** Default published-only for public feed. */
  status?: JinyeStatus | 'all';
  /** Exclude id (mis. pin sudah diambil terpisah). */
  excludeId?: string;
}

export interface JinyeComment {
  id: string;
  jinyeId: string;
  parentId: string | null;
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  userRole: string | null;
  body: string;
  bodyOriginal: string | null;
  images: JinyeImage[];
  status: JinyeCommentStatus;
  createdAt: Date;
  updatedAt: Date | null;
  replies?: JinyeComment[];
}

export interface NewJinyeComment {
  jinyeId: string;
  parentId?: string | null;
  userId: string;
  body: string;
  bodyOriginal?: string | null;
  images?: JinyeImage[];
}

export interface JinyeLemmaLink {
  id: string;
  jinyeId: string | null;
  commentId: string | null;
  start: number;
  end: number;
  wordId: string;
  lemma: string | null;
  status: JinyeLemmaLinkStatus;
  source: JinyeLemmaLinkSource;
  proposedWordId: string | null;
  proposedLemma: string | null;
  proposedBy: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export function toJinyeImages(rows: JinyeImageRow[] | null | undefined): JinyeImage[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => ({
    url: r.url,
    providerFileId: r.provider_file_id,
    publicUrl: r.public_url ?? null,
    contentWarnings: Array.isArray(r.content_warnings) ? r.content_warnings : [],
  }));
}

export function toImageRows(images: JinyeImage[]): JinyeImageRow[] {
  return images.map((i) => ({
    url: i.url,
    provider_file_id: i.providerFileId,
    public_url: i.publicUrl,
    content_warnings: i.contentWarnings,
  }));
}
