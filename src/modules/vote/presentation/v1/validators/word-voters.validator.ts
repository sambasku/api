import { z } from 'zod';
import { opaqueId } from '@/shared/validation/id';

export const listWordVotersParamsSchema = z.object({
  wordId: opaqueId,
});
export type ListWordVotersParams = z.infer<typeof listWordVotersParamsSchema>;

export const listWordVotersQuerySchema = z.object({
  meaning_id: opaqueId.optional(),
  value: z.coerce
    .number()
    .int()
    .refine((v) => v === 1 || v === -1, { message: 'Vote value harus 1 atau -1' })
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type ListWordVotersQuery = z.infer<typeof listWordVotersQuerySchema>;

const wordVoterWireSchema = z.object({
  id: z.string().length(26),
  voter_id: z.string().length(26),
  voter_username: z.string(),
  voter_display_name: z.string().nullable(),
  voter_avatar_url: z.string().nullable(),
  voter_email: z.string().email(),
  meaning_id: z.string().length(26),
  meaning_preview: z.string().nullable(),
  value: z.union([z.literal(1), z.literal(-1)]),
  created_at: z.string(),
});

export const listWordVotersResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(wordVoterWireSchema),
  meta: z.object({
    limit: z.number().int(),
    next_cursor: z.string().nullable(),
    has_more: z.boolean(),
    upvotes: z.number().int().nonnegative(),
    downvotes: z.number().int().nonnegative(),
  }),
});
