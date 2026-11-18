/**
 * Sensor pola PII di teks UGC → `***` (sama gaya blocklist).
 * Tidak menyentuh mention `@username` tanpa domain.
 */

const EMAIL_RE =
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

/** wa.me / api.whatsapp.com dengan nomor (tanpa spasi trailing di match). */
const WA_ME_RE =
  /\b(?:https?:\/\/)?(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)\+?\d{8,15}\b/gi;

/**
 * HP Indonesia: +62 / 62 / 0 diikuti 8–13 digit (spasi/dash opsional antar digit).
 * Hindari match angka pendek murni tanpa awalan.
 */
const ID_PHONE_RE =
  /(?:\+62|62|0)(?:[\s\-()]*\d){9,13}\b/g;

export function applyPiiPatternFilter(body: string): string {
  if (!body) return body;
  let result = body;
  result = result.replace(EMAIL_RE, '***');
  result = result.replace(WA_ME_RE, '***');
  result = result.replace(ID_PHONE_RE, '***');
  return result;
}
