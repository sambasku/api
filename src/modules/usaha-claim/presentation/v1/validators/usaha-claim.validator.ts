import { z } from 'zod';

export const claimEvidenceImageSchema = z
  .object({
    url: z.string().url().max(2000),
    provider_file_id: z.string().trim().min(1).max(255),
    alt_text: z.string().trim().max(200).nullable().optional(),
  })
  .strict();

export const submitClaimBodySchema = z
  .object({
    /** Legacy; opsional bila evidence_images terisi. */
    contact_evidence: z.string().trim().max(1000).optional(),
    evidence_images: z
      .array(claimEvidenceImageSchema)
      .min(1, 'Unggah minimal 1 bukti gambar')
      .max(5, 'Maksimal 5 bukti gambar'),
    note: z.string().max(1000).nullable().optional(),
  })
  .strict();

export const claimSlugParamSchema = z.object({ slug: z.string().min(1).max(120) });
export const claimIdParamSchema = z.object({ id: z.string().min(1).max(64) });

export const listClaimsQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).default('pending'),
});

export const rejectClaimBodySchema = z
  .object({
    reason_code: z.enum([
      'evidence_insufficient',
      'claim_conflict',
      'not_owner',
      'other',
    ]),
    reason_text: z.string().max(1000).nullable().optional(),
  })
  .strict();

/**
 * Bentuk wire klaim PUBLIK: bukti SENGAJA tidak ada
 * (PRD 6.4 & 18 - bukti verifikasi privat).
 */
export const publicUsahaClaimSchema = z.object({
  id: z.string(),
  usaha_id: z.string(),
  usaha_slug: z.string().optional(),
  usaha_name: z.string().optional(),
  note: z.string().nullable(),
  status: z.string(),
  reject_reason_code: z.string().nullable(),
  reject_reason_text: z.string().nullable(),
  created_at: z.string(),
  reviewed_at: z.string().nullable(),
});

/** Wire admin: bukti gambar (+ legacy teks) ikut (hanya antrean moderasi). */
export const adminUsahaClaimSchema = publicUsahaClaimSchema.extend({
  contact_evidence: z.string(),
  evidence_images: z.array(claimEvidenceImageSchema),
  user_id: z.string(),
  reviewed_by: z.string().nullable(),
});
