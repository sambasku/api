/**
 * Term sampah yang tidak boleh masuk `search_misses` sama sekali:
 * - semuanya angka (contoh `42`, `12 34`)
 * - semuanya non-huruf / simbol (contoh `!!!`, `---`, `@@@`)
 *
 * Lemma Sambas 2 huruf tetap lolos (punya `\p{L}`).
 */
export function isSearchMissJunkTerm(normalizedTerm: string): boolean {
  if (!normalizedTerm) return true;
  // Wajib ada minimal satu huruf Unicode.
  if (!/\p{L}/u.test(normalizedTerm)) return true;
  return false;
}

/**
 * Quality gate G3: term aman untuk auto-tayang di beranda.
 * Dipanggil setelah normalize (trim+lower+collapse, max 255).
 */
export function passesSearchMissQualityGate(normalizedTerm: string): boolean {
  if (normalizedTerm.length < 2 || normalizedTerm.length > 255) return false;
  if (isSearchMissJunkTerm(normalizedTerm)) return false;
  if (/https?:\/\//i.test(normalizedTerm) || /\bwww\./i.test(normalizedTerm)) {
    return false;
  }
  // Huruf, angka, spasi, apostrof, hyphen saja (boleh campur, mis. `kat4`).
  if (!/^[\p{L}\p{N}\s'\-]+$/u.test(normalizedTerm)) return false;
  return true;
}

/**
 * Token untuk cek blocklist (deny): term utuh + tiap kata.
 * Matching exact terhadap set aktif (bukan mask filter).
 */
export function searchMissBlocklistTokens(normalizedTerm: string): string[] {
  const tokens = normalizedTerm.split(/\s+/).filter(Boolean);
  const out = new Set<string>([normalizedTerm, ...tokens]);
  return [...out];
}
