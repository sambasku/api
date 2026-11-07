/** Normalisasi teks makna untuk perbandingan exact-match duplikat. */
export function normalizeMeaningText(value: string): string {
  // Cf = karakter format (zero-width, BOM, soft hyphen). Bukan spasi, jadi
  // \s tidak memakannya. "asin" dan "asin\u200b" harus satu sidik.
  const stripped = value.replace(/\p{Cf}/gu, '');
  return stripped.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Placeholder / kosong tidak dipakai sebagai kunci duplikat. */
export function isPlaceholderMeaningText(value: string): boolean {
  const normalized = normalizeMeaningText(value);
  return normalized.length === 0 || normalized === '-';
}
