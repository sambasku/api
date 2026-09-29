/** Normalisasi teks makna untuk perbandingan exact-match duplikat. */
export function normalizeMeaningText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Placeholder / kosong tidak dipakai sebagai kunci duplikat. */
export function isPlaceholderMeaningText(value: string): boolean {
  const normalized = normalizeMeaningText(value);
  return normalized.length === 0 || normalized === '-';
}
