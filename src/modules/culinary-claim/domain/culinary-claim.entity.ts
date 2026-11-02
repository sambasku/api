import type { CulinaryClaimStatus } from '@/shared/database/drizzle/schema/culinary-claims.schema';

/**
 * Klaim pengelolaan place kuliner (PRD 8).
 *
 * `contactEvidence` = bukti verifikasi PRIVAT: hanya boleh dikirim ke
 * antrean admin, TIDAK PERNAH ke endpoint publik (PRD 6.4 & 18).
 */
export interface CulinaryClaim {
  id: string;
  placeId: string;
  userId: string;
  contactEvidence: string;
  note: string | null;
  status: CulinaryClaimStatus;
  rejectReasonCode: string | null;
  rejectReasonText: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface CulinaryClaimWithPlace extends CulinaryClaim {
  placeName: string;
  placeSlug: string;
}

export const CULINARY_CLAIM_REJECT_DISPLAY: Record<string, string> = {
  evidence_insufficient: 'bukti belum cukup',
  claim_conflict: 'place ini sudah dikelola pihak lain',
  not_owner: 'identitas pemilik belum terbukti',
  other: 'alasan lain',
};

/** Copy alasan penolakan untuk UI (kode + teks bebas admin). */
export function composeCulinaryClaimRejectDisplay(
  code: string,
  text?: string | null,
): string {
  const base = CULINARY_CLAIM_REJECT_DISPLAY[code] ?? code;
  return text?.trim() ? `${base} - ${text.trim()}` : base;
}
