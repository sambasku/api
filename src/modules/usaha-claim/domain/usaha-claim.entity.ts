import type { UsahaClaimStatus } from '@/shared/database/drizzle/schema/usaha-claims.schema';

/**
 * Klaim pengelolaan usaha (PRD 8).
 *
 * `contactEvidence` = bukti verifikasi PRIVAT: hanya boleh dikirim ke
 * antrean admin, TIDAK PERNAH ke endpoint publik (PRD 6.4 & 18).
 */
export interface UsahaClaim {
  id: string;
  usahaId: string;
  userId: string;
  contactEvidence: string;
  note: string | null;
  status: UsahaClaimStatus;
  rejectReasonCode: string | null;
  rejectReasonText: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface UsahaClaimWithUsaha extends UsahaClaim {
  usahaName: string;
  usahaSlug: string;
}

export const USAHA_CLAIM_REJECT_DISPLAY: Record<string, string> = {
  evidence_insufficient: 'bukti belum cukup',
  claim_conflict: 'usaha ini sudah dikelola pihak lain',
  not_owner: 'identitas pemilik belum terbukti',
  other: 'alasan lain',
};

/** Copy alasan penolakan untuk UI (kode + teks bebas admin). */
export function composeClaimRejectDisplay(
  code: string,
  text?: string | null,
): string {
  const base = USAHA_CLAIM_REJECT_DISPLAY[code] ?? code;
  return text?.trim() ? `${base} - ${text.trim()}` : base;
}
