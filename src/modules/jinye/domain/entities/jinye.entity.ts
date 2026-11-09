import type { JinyeImageRow, JinyeStatus } from '@/shared/database/drizzle/schema/jinye.schema';

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
