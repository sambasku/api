/**
 * Kuota create/quote 1 / 24 jam.
 * Staging dimatikan supaya QA bisa uji reply + feed tanpa tunggu sehari.
 * Production (dan test/dev) tetap ditegakkan.
 */
export function isJinyeCreateQuotaEnforced(): boolean {
  return process.env.NODE_ENV !== 'staging';
}
