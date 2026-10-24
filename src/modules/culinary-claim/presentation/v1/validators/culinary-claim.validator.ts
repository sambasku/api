import { z } from 'zod';

export const submitClaimBodySchema = z
  .object({
    contact_evidence: z.string().trim().min(5).max(1000),
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
 * Bentuk wire klaim PUBLIK: `contact_evidence` SENGAJA tidak ada
 * (PRD 6.4 & 18 - bukti verifikasi privat).
 */
export const publicCulinaryClaimSchema = z.object({
  id: z.string(),
  place_id: z.string(),
  place_slug: z.string().optional(),
  place_name: z.string().optional(),
  note: z.string().nullable(),
  status: z.string(),
  reject_reason_code: z.string().nullable(),
  reject_reason_text: z.string().nullable(),
  created_at: z.string(),
  reviewed_at: z.string().nullable(),
});

/** Wire admin: bukti kontak ikut (hanya antrean moderasi). */
export const adminCulinaryClaimSchema = publicCulinaryClaimSchema.extend({
  contact_evidence: z.string(),
  user_id: z.string(),
  reviewed_by: z.string().nullable(),
});
