import type { ChildStatus } from '../../domain/entities/word.entity';

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
