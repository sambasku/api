/**
 * Bungkus URL CDN external (Pixabay, Openverse, Unsplash, Vimeo) dengan
 * wsrv.nl supaya thumbnail grid di mobile ter-file img lewat proxy yang
 * resize + compress ke webp. URL jsDelivr / ImageKit dikembalikan apa
 * adanya (sudah di-wrap displayImageUrl di mobile).
 */
export function proxyImageCdnUrl(
  url: string,
  { width = 640, height = 640 }: { width?: number; height?: number } = {},
): string {
  if (!url) return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === 'cdn.jsdelivr.net' ||
    host.endsWith('.jsdelivr.net') ||
    host === 'ik.imagekit.io'
  ) {
    return url;
  }
  const origin = `${host}${parsed.pathname}${parsed.search}`;
  return (
    `https://wsrv.nl/?url=${encodeURIComponent(origin)}` +
    `&w=${width}&h=${height}&fit=cover&output=webp`
  );
}
