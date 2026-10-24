import { generateId } from '@/shared/utils/ulid';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function extensionForImageMime(mimeType: string): string {
  return MIME_TO_EXT[mimeType] ?? 'jpg';
}

/** Path kata: assets/words/<ulid>.<ext> - ULID sebelum kata tersimpan. */
export function buildWordImagePath(mimeType: string): string {
  return `assets/words/${generateId()}.${extensionForImageMime(mimeType)}`;
}

/** Path avatar: assets/avatars/<userId>/<ulid>.<ext> */
export function buildAvatarImagePath(userId: string, mimeType: string): string {
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `assets/avatars/${safeUser}/${generateId()}.${extensionForImageMime(mimeType)}`;
}

/** Path ruang diskusi: assets/discussions/<ulid>.<ext> */
export function buildDiscussionImagePath(mimeType: string): string {
  return `assets/discussions/${generateId()}.${extensionForImageMime(mimeType)}`;
}

/** Path campaign notifikasi: assets/campaigns/<ulid>.<ext> */
export function buildCampaignImagePath(mimeType: string): string {
  return `assets/campaigns/${generateId()}.${extensionForImageMime(mimeType)}`;
}

/** Path foto place: assets/places/<ulid>.<ext> */
export function buildPlaceImagePath(mimeType: string): string {
  return `assets/places/${generateId()}.${extensionForImageMime(mimeType)}`;
}

/** Path poster acara: assets/events/<ulid>.<ext> */
export function buildEventImagePath(mimeType: string): string {
  return `assets/events/${generateId()}.${extensionForImageMime(mimeType)}`;
}

/** Path foto kuliner: assets/culinary/<ulid>.<ext> */
export function buildCulinaryImagePath(mimeType: string): string {
  return `assets/culinary/${generateId()}.${extensionForImageMime(mimeType)}`;
}

/** Path foto usaha: assets/usahas/<ulid>.<ext> */
export function buildUsahaImagePath(mimeType: string): string {
  return `assets/usahas/${generateId()}.${extensionForImageMime(mimeType)}`;
}
