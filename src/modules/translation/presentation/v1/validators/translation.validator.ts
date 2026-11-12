import { z } from 'zod';
import { TRANSLATION_REFFS } from '@/shared/database/drizzle/schema';
import { opaqueId } from '@/shared/validation/id';

export const listTranslationsQuerySchema = z.object({
  reff: z.enum(TRANSLATION_REFFS),
  /** Opsional: tanpa ini + `status` = antrian global per reff. */
  reff_id: opaqueId.optional(),
  status: z.enum(['pending', 'accepted', 'rejected']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export type ListTranslationsQuery = z.infer<typeof listTranslationsQuerySchema>;

export const createTranslationBodySchema = z.object({
  reff: z.enum(TRANSLATION_REFFS),
  reff_id: opaqueId,
  body: z.string().trim().min(1).max(1000),
});
export type CreateTranslationBody = z.infer<typeof createTranslationBodySchema>;

export const resolveTranslationBodySchema = z.object({
  action: z.enum(['approve', 'reject']),
});
export type ResolveTranslationBody = z.infer<
  typeof resolveTranslationBodySchema
>;

export const translationIdParamSchema = z.object({
  id: opaqueId,
});

export const translationWireSchema = z.object({
  id: z.string(),
  reff: z.string(),
  reff_id: z.string(),
  source_body: z.string(),
  body: z.string(),
  status: z.string(),
  translator_id: z.string(),
  reviewed_by: z.string().nullable(),
  reviewed_at: z.string().nullable(),
  created_at: z.string(),
});

export const translationResponseSchema = z.object({
  data: translationWireSchema,
});

export const listTranslationsResponseSchema = z.object({
  data: z.array(translationWireSchema),
});
