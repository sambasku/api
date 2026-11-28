/**
 * Id stabil foto kuliner (#387). Foto kuliner disimpan sebagai JSON di
 * `cuisines.images_json` tanpa id per foto, jadi ref = `<cuisineId>.<hash URL>`.
 * Hash sinkron (FNV-1a 2x seed berbeda, 16 hex) supaya bisa dipakai di mapper
 * wire sinkron tanpa `crypto.subtle`.
 */
export function photoUrlHash(url: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ 0x9e3779b9;
  for (let i = 0; i < url.length; i++) {
    const code = url.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ code, 0x85ebca6b) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

export function cuisinePhotoRef(cuisineId: string, url: string): string {
  return `${cuisineId}.${photoUrlHash(url)}`;
}

/** Pecah ref kuliner; null bila format tidak valid. */
export function parseCuisinePhotoRef(
  ref: string,
): { cuisineId: string; hash: string } | null {
  const idx = ref.lastIndexOf('.');
  if (idx <= 0 || idx === ref.length - 1) return null;
  return { cuisineId: ref.slice(0, idx), hash: ref.slice(idx + 1) };
}
