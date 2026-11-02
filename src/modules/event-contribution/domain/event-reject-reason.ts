/**
 * Kategori alasan penolakan usulan acara. Dipilih admin saat reject,
 * disimpan di `event_contributions.reject_reason_*`, tampil ke pengusul
 * lewat daftar usulan + copy notifikasi.
 */
export const EVENT_REJECT_REASON_CODES = [
  "not_suitable",
  "duplicate",
  "inaccurate",
  "past_event",
  "other",
] as const;

export type EventRejectReasonCode = (typeof EVENT_REJECT_REASON_CODES)[number];

export const EVENT_REJECT_REASON_LABELS: Record<EventRejectReasonCode, string> = {
  not_suitable: "Tidak layak sebagai acara",
  duplicate: "Sama dengan acara yang sudah terdaftar",
  inaccurate: "Data atau jadwal tidak akurat",
  past_event: "Acara sudah lewat",
  other: "Lainnya",
};

/** Compose teks tampilan: `label` atau `label: catatan`. */
export function composeEventRejectDisplay(
  code: string,
  text?: string | null,
): string {
  const label = EVENT_REJECT_REASON_CODES.includes(
    code as EventRejectReasonCode,
  )
    ? EVENT_REJECT_REASON_LABELS[code as EventRejectReasonCode]
    : "Ditolak";
  const detail = text?.trim();
  if (!detail) return label;
  return `${label}: ${detail}`;
}
