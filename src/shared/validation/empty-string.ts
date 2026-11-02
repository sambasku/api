import { z } from 'zod';

/** Client lama sering kirim `""` untuk field yang belum di-resolve / opsional. */
export function isBlankId(value: unknown): boolean {
  return value == null || (typeof value === 'string' && value.trim() === '');
}

/**
 * `""` / null / undefined → undefined, lalu jalankan schema (biasanya `.optional()`).
 * Pola sama dengan culinary/event validator.
 */
export function emptyAsUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => (isBlankId(value) ? undefined : value), schema);
}

/**
 * `""` / null / undefined → null, lalu jalankan schema (biasanya `.nullable()`).
 * Untuk FK opsional seperti word_class_id.
 */
export function emptyAsNull<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => (isBlankId(value) ? null : value), schema);
}
