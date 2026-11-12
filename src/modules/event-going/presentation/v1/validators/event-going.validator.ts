import { z } from 'zod';
import { opaqueId } from '@/shared/validation/id';

export const eventGoingParamsSchema = z.object({
  id: opaqueId,
});
export type EventGoingParams = z.infer<typeof eventGoingParamsSchema>;

export const eventGoingStateSchema = z.object({
  success: z.literal(true),
  data: z.object({
    event_id: z.string(),
    going_count: z.number().int().nonnegative(),
    viewer_going: z.boolean(),
  }),
});

export const listEventGoingsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type ListEventGoingsQuery = z.infer<typeof listEventGoingsQuerySchema>;

export const listEventGoingsResponseSchema = z.object({
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
