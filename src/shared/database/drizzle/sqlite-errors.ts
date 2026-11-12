/** Deteksi constraint SQLite/libSQL (pengganti kode Postgres 23505 / 23503). */

import { collectCodes, collectMessages } from '@/shared/errors/error-chain';

export function isUniqueViolation(err: unknown): boolean {
  const codes = collectCodes(err);
  if (
    codes.some(
      (c) =>
        c === 'SQLITE_CONSTRAINT_UNIQUE' ||
        c === 'SQLITE_CONSTRAINT' ||
        c === '23505',
    )
  ) {
    const msgs = collectMessages(err).join(' ').toLowerCase();
    // SQLITE_CONSTRAINT generik: pastikan unique, bukan FK
    if (codes.includes('SQLITE_CONSTRAINT_UNIQUE') || codes.includes('23505')) return true;
    return msgs.includes('unique');
  }
  const msgs = collectMessages(err).join(' ').toLowerCase();
  return msgs.includes('unique constraint') || msgs.includes('unique constraint failed');
}

/** True bila unique violation berasal dari index/table bernama ini (haystack message + cause). */
export function isUniqueViolationOn(err: unknown, needle: string): boolean {
  if (!isUniqueViolation(err)) return false;
  return collectMessages(err).join(' ').toLowerCase().includes(needle.toLowerCase());
}

/**
 * True bila error = ABORT dari trigger guard username (RAISE(ABORT, 'username
 * harus handle...')). Terjadi saat versi app tertinggal dari skema DB (mis.
 * container lama min 3 vs trigger min 6). Dipakai insert-retry supaya
 * kandidat username berikutnya dicoba, bukan 500 unhandled.
 */
export function isUsernameHandleConstraint(err: unknown): boolean {
  return collectMessages(err).join(' ').toLowerCase().includes('username harus handle');
}
export function isForeignKeyViolation(err: unknown): boolean {
  const codes = collectCodes(err);
  if (
    codes.some(
      (c) =>
        c === 'SQLITE_CONSTRAINT_FOREIGNKEY' ||
        c === '23503',
    )
  ) {
    return true;
  }
  const msgs = collectMessages(err).join(' ').toLowerCase();
  return msgs.includes('foreign key');
}
