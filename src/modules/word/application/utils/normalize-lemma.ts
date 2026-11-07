/** Bentuk simpan lemma: spasi pinggir dibuang, huruf dilipat kecil. */
export function normalizeLemma(lemma: string): string {
  return lemma.trim().toLowerCase();
}
