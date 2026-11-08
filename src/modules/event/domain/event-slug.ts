/** Path tetap web/app di bawah `/acara`. Jangan dipakai sebagai slug acara. */
const RESERVED_EVENT_SLUGS = new Set(["kontribusi", "usulan"]);

export function isReservedEventSlug(slug: string): boolean {
  return RESERVED_EVENT_SLUGS.has(slug);
}

/**
 * Pilih slug pertama yang bukan reserved dan belum terpakai.
 * Semua kandidat habis → `{base}-{timestamp}` (bukan loop query).
 */
export function pickEventSlug(candidates: string[], taken: Set<string>): string {
  for (const slug of candidates) {
    if (isReservedEventSlug(slug) || taken.has(slug)) continue;
    return slug;
  }
  const base = candidates[0] || "acara";
  return `${base}-${Date.now()}`;
}
