import { isForeignKeyViolation, isUniqueViolation } from '@/shared/database/drizzle/sqlite-errors';
import type { AppTransaction } from '@/shared/database/drizzle/client';
import { ValidationError } from '@/shared/errors/app-error';
import type { ChildStatus, WordStatus } from '../domain/entities/word.entity';

/** Tipe transaction Drizzle - dipakai helper yang menerima tx. */
export type Tx = AppTransaction;

export function verificationCols(isVerified: boolean, actorId: string, at = new Date()) {
  return isVerified
    ? { verifiedBy: actorId, verifiedAt: at }
    : { verifiedBy: null, verifiedAt: null };
}

export function escapeLike(q: string): string {
  return q.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/** Pencarian natural: "paddas aek" = cocok %paddas% ATAU %aek% (max 5 token). */
export function searchTerms(q: string): string[] {
  return [...new Set(q.trim().toLowerCase().split(/\s+/).filter(Boolean))].slice(0, 5);
}

/**
 * Anak yang ikut submit kata mengikuti gerbang kata-nya: kata pending → anak
 * pending; approve/reject kata ikut memutuskan nasib anak.
 */
export function childStatusOf(wordStatus: WordStatus): ChildStatus {
  return wordStatus === 'published' ? 'published' : 'pending_review';
}

/**
 * Antrean mengikuti "perlu dicek", bukan "belum tayang".
 * pending_review (tamu) dan published belum diverifikasi = pending.
 */
export function contributionStatusOf(status: string, isVerified: boolean): 'pending' | 'approved' {
  if (status === 'pending_review') return 'pending';
  if (status === 'published' && !isVerified) return 'pending';
  return 'approved';
}

/** Mapping error SQLite/Postgres untuk insert kontribusi media - jangan bocor 500. */
export function mapMediaViolation(err: unknown, uniqueField: string): void {
  if (isForeignKeyViolation(err)) {
    throw new ValidationError([
      { field: '', message: 'Referensi data tidak valid (data terkait mungkin sudah dihapus)' },
    ]);
  }
  if (isUniqueViolation(err)) {
    throw new ValidationError([{ field: uniqueField, message: 'Data duplikat - sudah ada entri yang sama' }]);
  }
}
