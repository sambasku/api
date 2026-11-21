import { z } from 'zod';
import { opaqueId } from '@/shared/validation/id';

export const usahaVisitParamsSchema = z.object({
  id: opaqueId,
});
export type UsahaVisitParams = z.infer<typeof usahaVisitParamsSchema>;

export const usahaVisitStateSchema = z.object({
  success: z.literal(true),
  data: z.object({
    usaha_id: z.string(),
    visit_count: z.number().int().nonnegative(),
    viewer_visited: z.boolean(),
  }),
});

export const listUsahaVisitsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type ListUsahaVisitsQuery = z.infer<typeof listUsahaVisitsQuerySchema>;

export const listUsahaVisitsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(
    z.object({
      id: z.string(),
      user_id: z.string(),
      username: z.string(),
      display_name: z.string().nullable(),
      avatar_url: z.string().nullable(),
      created_at: z.string(),
    }),
  ),
  meta: z.object({
    limit: z.number().int(),
    next_cursor: z.string().nullable(),
    has_more: z.boolean(),
    total: z.number().int().nonnegative(),
  }),
});