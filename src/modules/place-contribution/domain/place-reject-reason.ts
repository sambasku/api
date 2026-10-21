/**
 * Kategori alasan penolakan usulan wisata. Dipilih admin saat reject,
 * disimpan di `place_contributions.reject_reason_*`, tampil ke pengusul
 * lewat daftar usulan + copy notifikasi.
 */
export const PLACE_REJECT_REASON_CODES = [
  'not_suitable',
  'duplicate',
  'inaccurate',
  'other',
] as const;

export type PlaceRejectReasonCode = (typeof PLACE_REJECT_REASON_CODES)[number];

export const PLACE_REJECT_REASON_LABELS: Record<PlaceRejectReasonCode, string> = {
  not_suitable: 'Tidak layak sebagai tempat wisata',
  duplicate: 'Sama dengan tempat yang sudah terdaftar',
  inaccurate: 'Data atau lokasi tidak akurat',
  other: 'Lainnya',
};

/** Compose teks tampilan: `label` atau `label: catatan`. */
export function composePlaceRejectDisplay(code: string, text?: string | null): string {
  const label =
    PLACE_REJECT_REASON_CODES.includes(code as PlaceRejectReasonCode)
      ? PLACE_REJECT_REASON_LABELS[code as PlaceRejectReasonCode]
      : 'Ditolak';
  const detail = text?.trim();
  if (!detail) return label;
  return `${label}: ${detail}`;
}
