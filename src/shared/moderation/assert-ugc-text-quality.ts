import { createHash } from 'node:crypto';
import { BadRequestError } from '@/shared/errors/app-error';

export interface UgcTextQualityOpts {
  /** Minimal karakter bermakna (huruf/angka) setelah normalisasi. Default 1. */
  minMeaningfulChars?: number;
  /** Body ternormalisasi dari kiriman baru-baru ini (duplikat exact). */
  recentBodies?: string[];
  /** Nama field untuk details error. Default `body`. */
  field?: string;
}

export type UgcTextQualityResult =
  | { ok: true; normalized: string }
  | { ok: false; reason: string };

const REPEAT_CHAR_RE = /(.)\1{5,}/u;
const LETTER_RE = /\p{L}/u;

function collapseWs(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

/** Hash untuk deteksi duplikat / meta abuse (sha256 hex pendek). */
export function hashUgcBody(normalized: string): string {
  return createHash('sha256').update(normalized.toLowerCase()).digest('hex').slice(0, 32);
}

/**
 * Heuristik "asal-asalan" untuk teks UGC (komentar, diskusi, gloss).
 * Tidak mengganti Zod min/max - dipanggil setelah trim dasar.
 */
export function assessUgcTextQuality(
  raw: string,
  opts: UgcTextQualityOpts = {},
): UgcTextQualityResult {
  const field = opts.field ?? 'body';
  const minMeaningful = opts.minMeaningfulChars ?? 1;
  const normalized = collapseWs(raw);

  if (normalized.length === 0) {
    return { ok: false, reason: `${field} kosong` };
  }

  if (REPEAT_CHAR_RE.test(normalized)) {
    return { ok: false, reason: 'Teks terlalu banyak karakter berulang' };
  }

  const letters = [...normalized].filter((ch) => LETTER_RE.test(ch));
  if (letters.length < minMeaningful) {
    return { ok: false, reason: 'Teks harus mengandung huruf yang bermakna' };
  }

  const uniqueLetters = new Set(letters.map((ch) => ch.toLowerCase()));
  // Keyboard smash: banyak huruf tapi hampir semua sama / sangat sedikit unik
  if (letters.length >= 8 && uniqueLetters.size / letters.length < 0.25) {
    return { ok: false, reason: 'Teks tidak terlihat bermakna' };
  }
  if (letters.length >= 12 && uniqueLetters.size <= 3) {
    return { ok: false, reason: 'Teks tidak terlihat bermakna' };
  }

  const nonSpace = normalized.replace(/\s+/g, '');
  const letterRatio = letters.length / Math.max(nonSpace.length, 1);
  if (nonSpace.length >= 6 && letterRatio < 0.35) {
    return { ok: false, reason: 'Teks terlalu banyak simbol atau angka' };
  }

  const recent = opts.recentBodies ?? [];
  const normLower = normalized.toLowerCase();
  if (recent.some((b) => collapseWs(b).toLowerCase() === normLower)) {
    return { ok: false, reason: 'Pesan sama baru saja dikirim. Tunggu sebentar.' };
  }

  return { ok: true, normalized };
}

export function assertUgcTextQuality(raw: string, opts?: UgcTextQualityOpts): string {
  const result = assessUgcTextQuality(raw, opts);
  if (!result.ok) {
    throw new BadRequestError('UGC_INPUT_REJECTED', result.reason, [
      { field: opts?.field ?? 'body', message: result.reason },
    ]);
  }
  return result.normalized;
}

/** Sensor blocklist dianggap berat jika sisa teks bermakna < 50% asli. */
export function isHeavyCensor(original: string, filtered: string): boolean {
  if (original === filtered) return false;
  const orig = original.replace(/\s+/g, '');
  if (orig.length === 0) return false;
  const remaining = filtered.replace(/\*{3}/g, '').replace(/\s+/g, '');
  return remaining.length / orig.length < 0.5;
}
