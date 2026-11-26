export type JinyeImageProvider = 'github' | 'imagekit';

const GITHUB_PATH = /^assets\/jinye\/[A-Za-z0-9_-]+\.(?:jpg|png|webp)$/;
const JSDELIVR_PREFIX = 'https://cdn.jsdelivr.net/gh/';

/** `assets/...` = repo GitHub (jsDelivr); selain itu = ImageKit lama. */
export function jinyeImageProvider(providerFileId: string): JinyeImageProvider {
  return providerFileId.startsWith('assets/') ? 'github' : 'imagekit';
}

/**
 * Foto Jinye hanya boleh dari penyimpanan kita: file hasil `POST /jinye/images`
 * (jsDelivr + path `assets/jinye/`) atau host ImageKit milik kita (build mobile
 * lama). URL klien lain ditolak: server mengunduh URL ini saat promote/backfill
 * (cegah SSRF) dan Jinye tidak jadi pintu hotlink / tracking pixel.
 */
export function isTrustedJinyeImage(
  img: { url: string; providerFileId: string },
  imageKitEndpoint: string | undefined,
): boolean {
  const url = img.url.trim();
  const fileId = img.providerFileId.trim();
  if (jinyeImageProvider(fileId) === 'github') {
    return (
      GITHUB_PATH.test(fileId) &&
      url.startsWith(JSDELIVR_PREFIX) &&
      url.endsWith(`/${fileId}`)
    );
  }
  const endpoint = imageKitEndpoint?.trim();
  if (!endpoint) return false;
  try {
    const target = new URL(url);
    const allowed = new URL(endpoint);
    return target.protocol === 'https:' && target.host === allowed.host;
  } catch {
    return false;
  }
}
