import { z } from 'zod';
import { KREATOR_KINDS } from '@/shared/database/drizzle/schema/kreators.schema';
import { opaqueId } from '@/shared/validation/id';

export const listKreatorsQuerySchema = z.object({
  q: z.string().max(80).optional(),
});

export const kreatorSlugParamSchema = z.object({
  slug: z.string().min(1).max(80),
});

export const kreatorIdParamSchema = z.object({
  id: opaqueId,
});

export const creditIdParamSchema = z.object({
  id: opaqueId,
});

export const claimIdParamSchema = z.object({
  id: opaqueId,
});

export const submitKreatorClaimSchema = z.object({
  proof_note: z
    .string()
    .trim()
    .min(10, 'Ceritakan bukti klaim kamu (minimal 10 karakter)')
    .max(2000),
});

export const adminKreatorBodySchema = z.object({
  display_name: z.string().trim().min(1).max(120),
  kind: z.enum(KREATOR_KINDS).default('person'),
  bio: z.string().trim().max(4000).optional().nullable(),
  origin_region: z.string().trim().max(200).optional().nullable(),
  links: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(80),
        url: z.string().trim().url('URL tidak valid'),
      }),
    )
    .max(10)
    .optional(),
});

export const adminKreatorUpdateSchema = adminKreatorBodySchema.partial();

export const linkCreditBodySchema = z
  .object({
    kreator_id: opaqueId.optional(),
    display_name: z.string().trim().min(1).max(120).optional(),
  })
  .refine((b) => !!(b.kreator_id || b.display_name), {
    message: 'Isi kreator_id atau display_name',
  });

export const rejectKreatorClaimSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});

export const adminClaimsQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
});