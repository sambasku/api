import type { UsahaClaimStatus } from '@/shared/database/drizzle/schema/usaha-claims.schema';

/** Satu gambar bukti klaim (ImageKit, privat - hanya antrean admin). */
export interface UsahaClaimEvidenceImage {
  url: string;
  provider_file_id: string;
  alt_text?: string | null;
}

/**
 * Klaim pengelolaan usaha (PRD 8).
 *
 * `evidenceImages` / `contactEvidence` = bukti verifikasi PRIVAT: hanya
 * boleh dikirim ke antrean admin, TIDAK PERNAH ke endpoint publik
 * (PRD 6.4 & 18).
 */
export interface UsahaClaim {
  id: string;
  usahaId: string;
  userId: string;
  contactEvidence: string;
  evidenceImages: UsahaClaimEvidenceImage[];
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

/** Parse kolom JSON `evidence_images` (defensif terhadap data rusak). */
export function parseEvidenceImages(raw: string | null | undefined): UsahaClaimEvidenceImage[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is UsahaClaimEvidenceImage =>
          !!item &&
          typeof item === 'object' &&
          typeof (item as UsahaClaimEvidenceImage).url === 'string' &&
          typeof (item as UsahaClaimEvidenceImage).provider_file_id === 'string',
      )
      .map((item) => ({
        url: item.url,
        provider_file_id: item.provider_file_id,
        alt_text: item.alt_text ?? null,
      }));
  } catch {
    return [];
  }
}
