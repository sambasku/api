/**
 * Quality gate G3: term aman untuk auto-tayang di beranda.
 * Dipanggil setelah normalize (trim+lower+collapse, max 255).
 */
export function passesSearchMissQualityGate(normalizedTerm: string): boolean {
  if (normalizedTerm.length < 2 || normalizedTerm.length > 255) return false;
  if (/https?:\/\//i.test(normalizedTerm) || /\bwww\./i.test(normalizedTerm)) {
    return false;
  }
  // Minimal satu huruf (Unicode) - tolak angka/simbol polos.
  if (!/\p{L}/u.test(normalizedTerm)) return false;
  // Huruf, angka, spasi, apostrof, hyphen saja.
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
