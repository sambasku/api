// Normalisasi nama kategori usulan: trim, spasi ganda jadi satu, huruf
// pertama kapital. Duplikat dicek case-insensitive di use case - nama master
// yang sudah ada ("Binatang & Hewan") jangan kebagi varian "binatang & hewan".
export function normalizeCategoryName(raw: string): string {
  const collapsed = raw.trim().replace(/\s+/g, ' ');
  if (collapsed.length === 0) return collapsed;
  return collapsed.charAt(0).toUpperCase() + collapsed.slice(1);
}
