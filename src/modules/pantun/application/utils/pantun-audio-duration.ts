import { ValidationError } from '@/shared/errors/app-error';

/** Durasi bacaan pantun: min 7,5s, max 60s (keputusan produk #254). */
export const PANTUN_AUDIO_MIN_MS = 7_500;
export const PANTUN_AUDIO_MAX_MS = 60_000;

/**
 * Validasi duration_ms dari client. Tolak di luar 7,5-60s
 * (bukan clamp diam-diam seperti discussion).
 */
export function assertPantunAudioDurationMs(raw: unknown): number {
  const n =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? Number(raw)
        : NaN;
  if (!Number.isFinite(n) || n <= 0) {
    throw new ValidationError([
      {
        field: 'duration_ms',
        message: 'Durasi rekaman wajib diisi (7,5-60 detik)',
      },
    ]);
  }
  const ms = Math.round(n);
  if (ms < PANTUN_AUDIO_MIN_MS) {
    throw new ValidationError([
      {
        field: 'duration_ms',
        message: 'Rekaman terlalu pendek. Minimal 7,5 detik ya.',
      },
    ]);
  }
  if (ms > PANTUN_AUDIO_MAX_MS) {
    throw new ValidationError([
      {
        field: 'duration_ms',
        message: 'Rekaman terlalu panjang. Maksimal 60 detik.',
      },
    ]);
  }
  return ms;
}
