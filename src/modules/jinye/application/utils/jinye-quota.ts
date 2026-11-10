/** Kuota create/quote: 1 / jam / user. */
export const JINYE_CREATE_QUOTA_MS = 60 * 60 * 1000;

/**
 * Staging dimatikan supaya QA bisa uji reply + feed tanpa tunggu.
 * Production (dan test/dev) tetap ditegakkan.
 */
export function isJinyeCreateQuotaEnforced(): boolean {
  return process.env.NODE_ENV !== 'staging';
}

/** Pesan 429 + Retry-After (detik) dari sisa jendela kuota. */
export function jinyeCreateQuotaLimited(
  elapsedMs: number,
): { message: string; retryAfterSeconds: number } {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((JINYE_CREATE_QUOTA_MS - elapsedMs) / 1000),
  );
  if (retryAfterSeconds < 60) {
    return {
      message: `Kamu sudah membuat Jinye dalam 1 jam terakhir. Coba lagi sekitar ${retryAfterSeconds} detik lagi ya.`,
      retryAfterSeconds,
    };
  }
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return {
    message: `Kamu sudah membuat Jinye dalam 1 jam terakhir. Coba lagi sekitar ${minutes} menit lagi ya.`,
    retryAfterSeconds,
  };
}
