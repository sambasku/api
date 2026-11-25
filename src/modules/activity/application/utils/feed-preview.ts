import type { ActivityEventKind } from '../../domain/entities/activity-event.entity';

export type FeedPreview = {
  previewImageUrl: string | null;
  previewImageCount: number | null;
};

function pickImageUrl(url: string | null | undefined): string | null {
  if (url == null) return null;
  const s = url.trim();
  return s.length > 0 ? s : null;
}

/** URL publik dari baris gambar JSON (Jinye, diskusi, dll). */
export function urlsFromImageJsonRows(rows: unknown): { url: string | null; count: number } {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { url: null, count: 0 };
  }
  const urls: string[] = [];
  for (const item of rows) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const u = pickImageUrl(
      (typeof r.public_url === 'string' ? r.public_url : null) ??
        (typeof r.url === 'string' ? r.url : null),
    );
    if (u) urls.push(u);
  }
  if (urls.length === 0) return { url: null, count: 0 };
  return { url: urls[0]!, count: urls.length };
}

const PHOTO_DEDUPE_PREFIXES = [
  'place_photo:',
  'usaha_photo:',
  'cuisine_photo:',
  'event_photo:',
] as const;

/**
 * Batch unggah foto: `place_photo:{entityId}:{urlA|urlB}`.
 * entityId tidak mengandung `:`; URL boleh `https://`.
 */
export function urlsFromPhotoDedupeKey(dedupeKey: string | null | undefined): {
  url: string | null;
  count: number;
} {
  if (dedupeKey == null) return { url: null, count: 0 };
  const key = dedupeKey.trim();
  if (!PHOTO_DEDUPE_PREFIXES.some((p) => key.startsWith(p))) {
    return { url: null, count: 0 };
  }
  const firstColon = key.indexOf(':');
  const secondColon = key.indexOf(':', firstColon + 1);
  if (secondColon < 0) return { url: null, count: 0 };
  const urls = key
    .slice(secondColon + 1)
    .split('|')
    .map((u) => u.trim())
    .filter((u) => u.length > 0);
  if (urls.length === 0) return { url: null, count: 0 };
  return { url: urls[0]!, count: urls.length };
}

function commentPreviewUrl(
  publicUrl: string | null | undefined,
  imageUrl: string | null | undefined,
): string | null {
  return pickImageUrl(publicUrl) ?? pickImageUrl(imageUrl);
}

export type FeedPreviewRow = {
  kind: ActivityEventKind;
  dedupeKey?: string | null;
  wordImageUrl?: string | null;
  discussionImages?: unknown;
  jinyeImages?: unknown;
  jinyeCommentImages?: unknown;
  wordCommentImagePublicUrl?: string | null;
  wordCommentImageUrl?: string | null;
  placeCommentImagePublicUrl?: string | null;
  placeCommentImageUrl?: string | null;
  usahaCommentImagePublicUrl?: string | null;
  usahaCommentImageUrl?: string | null;
  cuisineCommentImagePublicUrl?: string | null;
  cuisineCommentImageUrl?: string | null;
  eventCommentImagePublicUrl?: string | null;
  eventCommentImageUrl?: string | null;
  karyaCommentImagePublicUrl?: string | null;
  karyaCommentImageUrl?: string | null;
  articleCommentImagePublicUrl?: string | null;
  articleCommentImageUrl?: string | null;
};

export function resolveFeedPreview(row: FeedPreviewRow): FeedPreview {
  const kind = row.kind;
  let url: string | null = null;
  let count: number | null = null;

  switch (kind) {
    case 'place_photo_added':
    case 'usaha_photo_added':
    case 'cuisine_photo_added':
    case 'event_photo_added': {
      const parsed = urlsFromPhotoDedupeKey(row.dedupeKey);
      url = parsed.url;
      if (parsed.count > 1) count = parsed.count;
      break;
    }
    case 'contribution_image':
      url = pickImageUrl(row.wordImageUrl);
      break;
    case 'jinye_created':
    case 'jinye_quote_created':
    case 'jinye_reposted': {
      const parsed = urlsFromImageJsonRows(row.jinyeImages);
      url = parsed.url;
      if (parsed.count > 1) count = parsed.count;
      break;
    }
    case 'jinye_comment_created': {
      const parsed = urlsFromImageJsonRows(row.jinyeCommentImages);
      url = parsed.url;
      if (parsed.count > 1) count = parsed.count;
      break;
    }
    case 'discussion_created': {
      const parsed = urlsFromImageJsonRows(row.discussionImages);
      url = parsed.url;
      if (parsed.count > 1) count = parsed.count;
      break;
    }
    case 'comment_created':
      url = commentPreviewUrl(row.wordCommentImagePublicUrl, row.wordCommentImageUrl);
      break;
    case 'place_comment_created':
      url = commentPreviewUrl(row.placeCommentImagePublicUrl, row.placeCommentImageUrl);
      break;
    case 'usaha_comment_created':
      url = commentPreviewUrl(row.usahaCommentImagePublicUrl, row.usahaCommentImageUrl);
      break;
    case 'cuisine_comment_created':
      url = commentPreviewUrl(row.cuisineCommentImagePublicUrl, row.cuisineCommentImageUrl);
      break;
    case 'event_comment_created':
      url = commentPreviewUrl(row.eventCommentImagePublicUrl, row.eventCommentImageUrl);
      break;
    case 'karya_comment_created':
      url = commentPreviewUrl(row.karyaCommentImagePublicUrl, row.karyaCommentImageUrl);
      break;
    case 'article_comment_created':
      url = commentPreviewUrl(row.articleCommentImagePublicUrl, row.articleCommentImageUrl);
      break;
    default:
      break;
  }

  return {
    previewImageUrl: url,
    previewImageCount: url != null && count != null && count > 1 ? count : null,
  };
}