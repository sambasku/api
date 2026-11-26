import type {
  CommentAudio,
  CommentImage,
  CommentImageStatus,
} from '@/modules/comment/domain/entities/comment.entity';

export type { CommentAudio, CommentImage, CommentImageStatus };

export interface EntityCommentMediaRow {
  stickerId?: string | null;
  audioUrl?: string | null;
  audioMimeType?: string | null;
  audioFileSize?: number | null;
  audioDurationMs?: number | null;
  audioProvider?: string | null;
  audioProviderFileId?: string | null;
  audioSha?: string | null;
  imageUrl?: string | null;
  imageProvider?: string | null;
  imageProviderFileId?: string | null;
  imagePublicUrl?: string | null;
  imageStatus?: string | null;
  imageContentWarnings?: string | null;
  imageReviewedBy?: string | null;
  imageReviewedAt?: Date | null;
}

function parseContentWarnings(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
}

export function toEntityCommentAudio(row: EntityCommentMediaRow): CommentAudio | null {
  const hasAudio =
    typeof row.audioUrl === 'string' &&
    row.audioUrl.length > 0 &&
    typeof row.audioMimeType === 'string' &&
    typeof row.audioProvider === 'string' &&
    typeof row.audioProviderFileId === 'string';
  if (!hasAudio) return null;
  return {
    url: row.audioUrl as string,
    mimeType: row.audioMimeType as string,
    fileSize: row.audioFileSize ?? 0,
    durationMs: row.audioDurationMs ?? null,
    provider: row.audioProvider as string,
    providerFileId: row.audioProviderFileId as string,
    sha: row.audioSha ?? null,
  };
}

export function toEntityCommentImage(row: EntityCommentMediaRow): CommentImage | null {
  const status = row.imageStatus as CommentImageStatus | null;
  if (
    !status ||
    (status !== 'pending_review' && status !== 'published' && status !== 'rejected')
  ) {
    return null;
  }
  if (
    typeof row.imageUrl !== 'string' ||
    row.imageUrl.length === 0 ||
    typeof row.imageProvider !== 'string' ||
    typeof row.imageProviderFileId !== 'string'
  ) {
    if (status === 'rejected') {
      return {
        url: row.imageUrl ?? '',
        provider: row.imageProvider ?? '',
        providerFileId: row.imageProviderFileId ?? '',
        publicUrl: null,
        status,
        contentWarnings: parseContentWarnings(row.imageContentWarnings),
        reviewedBy: row.imageReviewedBy ?? null,
        reviewedAt: row.imageReviewedAt ?? null,
      };
    }
    return null;
  }
  return {
    url: row.imageUrl,
    provider: row.imageProvider,
    providerFileId: row.imageProviderFileId,
    publicUrl: row.imagePublicUrl ?? null,
    status,
    contentWarnings: parseContentWarnings(row.imageContentWarnings),
    reviewedBy: row.imageReviewedBy ?? null,
    reviewedAt: row.imageReviewedAt ?? null,
  };
}

export interface NewEntityCommentImageInput {
  url: string;
  provider: string;
  providerFileId: string;
}

export interface NewEntityCommentAudioInput {
  url: string;
  mimeType: string;
  fileSize: number;
  durationMs: number | null;
  provider: string;
  providerFileId: string;
  sha: string | null;
}

export function entityCommentImageInsertValues(image: NewEntityCommentImageInput | null | undefined) {
  if (!image) {
    return {
      imageUrl: null,
      imageProvider: null,
      imageProviderFileId: null,
      imagePublicUrl: null,
      imageStatus: null,
      imageContentWarnings: null,
      imageReviewedBy: null,
      imageReviewedAt: null,
    };
  }
  return {
    imageUrl: image.url,
    imageProvider: image.provider,
    imageProviderFileId: image.providerFileId,
    imagePublicUrl: image.url,
    imageStatus: 'published' as const,
    imageContentWarnings: '[]',
    imageReviewedBy: null,
    imageReviewedAt: null,
  };
}

export function entityCommentAudioInsertValues(audio: NewEntityCommentAudioInput | null | undefined) {
  if (!audio) {
    return {
      audioUrl: null,
      audioMimeType: null,
      audioFileSize: null,
      audioDurationMs: null,
      audioProvider: null,
      audioProviderFileId: null,
      audioSha: null,
    };
  }
  return {
    audioUrl: audio.url,
    audioMimeType: audio.mimeType,
    audioFileSize: audio.fileSize,
    audioDurationMs: audio.durationMs,
    audioProvider: audio.provider,
    audioProviderFileId: audio.providerFileId,
    audioSha: audio.sha,
  };
}