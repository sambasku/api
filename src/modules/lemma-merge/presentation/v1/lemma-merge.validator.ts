import { z } from 'zod';
import { opaqueId } from '@/shared/validation/id';

export const createLemmaMergeBodySchema = z.object({
  keep_word_id: opaqueId,
  merge_word_ids: z
    .array(opaqueId)
    .min(1, 'Pilih minimal satu entri untuk digabung')
    .max(8, 'Maksimal 8 entri per gabung'),
  reason_text: z.string().trim().max(500).optional(),
});

export const lemmaMergeIdParamSchema = z.object({
  id: opaqueId,
});

export const rejectLemmaMergeBodySchema = z.object({
  review_note: z.string().trim().max(500).optional(),
});

export const lemmaMergeResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string(),
    status: z.enum(['pending', 'approved', 'rejected']),
    keep_word_id: z.string(),
    merge_word_ids: z.array(z.string()),
    keep_lemma: z.string().optional(),
    message: z.string(),
  }),
});

export const adminListLemmaMergesQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
});

export type CreateLemmaMergeBody = z.infer<typeof createLemmaMergeBodySchema>;