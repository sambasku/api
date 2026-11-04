/** Util artikel ensiklopedia: slug, strip markdown, normalisasi tag. */

/** Slug dari judul (huruf kecil, hyphen). Sama pola slugifyUsaha. */
export function slugifyArticle(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'artikel'
  );
}

/**
 * Lucuti markdown jadi plain text untuk FTS. Bukan parser lengkap:
 * buang syntax umum (image, link, heading, emphasis, code, quote, hr,
 * table pipe) - sisa teks cukup untuk pencarian.
 */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, '$1')
    .replace(/\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s{0,3}([-*_])\s*\1\s*\1[\s\S]*?$/gm, '')
    .replace(/^\s*\|.*\|\s*$/gm, (line) => line.replace(/\|/g, ' '))
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/\r?\n{2,}/g, '\n')
    .trim();
}

/** Normalisasi satu nama tag -> slug (lowercase, hyphen). Maks 40 char. */
export function normalizeTag(name: string): string | null {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || null;
}

/** URL gambar markdown: hanya https dari host yang diizinkan. */
const ALLOWED_IMAGE_HOSTS = [
  'ik.imagekit.io',
  'cdn.jsdelivr.net',
  'raw.githubusercontent.com',
  'images.unsplash.com',
];

export function isAllowedImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      ALLOWED_IMAGE_HOSTS.includes(parsed.hostname)
    );
  } catch {
    return false;
  }
}

/** Ekstrak semua URL gambar `![alt](url)` dari markdown. */
export function extractImageUrls(md: string): string[] {
  const urls: string[] = [];
  const re = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(md)) !== null) {
    urls.push(match[1]!);
  }
  return urls;
}
