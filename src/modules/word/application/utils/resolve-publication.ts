import type { ChildStatus, WordStatus } from '../../domain/entities/word.entity';

// Tayang (`status`) dan dipercaya (`isVerified`) terpisah.
// Verifikator: published + terverifikasi, tidak masuk antrean.
// Kontributor login: published + belum diverifikasi, antrean tetap pending.
// Tamu (anonymous): pending_review, tidak tayang, antrean pending.
// Draft: tidak tayang, tidak masuk antrean.

/**
 * Cek "punya salah satu role verifikator" untuk actor multi role.
 * Menerima satu role ATAU array roles (interseksi).
 */
export function isVerifierRole(role: string | string[]): boolean {
  const verifier = ['admin', 'editor', 'root', 'reviewer'];
  const roles = Array.isArray(role) ? role : [role];
  return roles.some((r) => verifier.includes(r));
}

/** Status yang boleh dilihat verifikator di search/list/detail publik. */
export const VERIFIER_VISIBLE_STATUSES: WordStatus[] = ['published', 'pending_review'];

/** Gate baca publik vs verifikator (search / list / detail).
 * Publik: word `status=published`. Makna menunggu disaring di
 * `filterMeaningsForPublicDetail` (bukan di sini).
 */
export function publicReadGate(roles?: string | string[]): {
  statuses?: WordStatus[];
  published?: boolean;
} {
  if (roles && isVerifierRole(roles)) {
    return { statuses: VERIFIER_VISIBLE_STATUSES };
  }
  return { published: true };
}

export interface PublicationDecision {
  status: 'draft' | 'pending_review' | 'published';
  isVerified: boolean;
  needsReview: boolean;
}

export function resolvePublication(
  requested: 'draft' | 'published',
  role: string | string[],
  options?: { anonymous?: boolean },
): PublicationDecision {
  if (requested === 'draft') {
    return { status: 'draft', isVerified: false, needsReview: false };
  }
  if (options?.anonymous) {
    return { status: 'pending_review', isVerified: false, needsReview: true };
  }
  if (isVerifierRole(role)) {
    return { status: 'published', isVerified: true, needsReview: false };
  }
  return { status: 'published', isVerified: false, needsReview: true };
}

export function resolveChildPublication(
  role: string | string[],
  options?: { anonymous?: boolean },
): { status: ChildStatus; isVerified: boolean; needsReview: boolean } {
  const p = resolvePublication('published', role, options);
  return { status: p.status as ChildStatus, isVerified: p.isVerified, needsReview: p.needsReview };
}

/** Makna yang boleh tampil di detail kamus publik.
 *
 * Default: hanya `is_verified` (hindari ambiguitas makna menunggu).
 * Pengecualian:
 * - verifikator: semua makna (tinjau / badge menunggu)
 * - includeUnverified: semua (Periksa Kata / review komunitas)
 * - focusMeaningId: makna fokus ikut meski belum verified
 */
export function filterMeaningsForPublicDetail<
  T extends { id: string; isVerified: boolean },
>(
  meanings: T[],
  opts?: {
    viewerIsVerifier?: boolean;
    includeUnverified?: boolean;
    focusMeaningId?: string;
  },
): T[] {
  if (opts?.viewerIsVerifier || opts?.includeUnverified) return meanings;
  const focus = opts?.focusMeaningId?.trim();
  if (focus) return meanings.filter((m) => m.isVerified || m.id === focus);
  return meanings.filter((m) => m.isVerified);
}
