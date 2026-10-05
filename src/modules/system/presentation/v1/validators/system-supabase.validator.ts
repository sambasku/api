import { z } from '@hono/zod-openapi';

export const triggerSupabasePingResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      status: z.enum(['ok', 'failed']),
      http_status: z.number().int().nullable(),
      duration_ms: z.number().int(),
      error_message: z.string().nullable(),
    }),
  })
  .openapi('TriggerSupabasePingResponse');

export const listSupabaseHealthChecksQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    cursor: z.string().length(26).optional(),
    env: z.enum(['staging', 'production']).optional(),
  })
  .openapi('ListSupabaseHealthChecksQuery');

const healthCheckItemSchema = z.object({
  id: z.string(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  project_label: z.string(),
  project_ref: z.string(),
  env: z.enum(['staging', 'production']),
  http_status: z.number().int().nullable(),
  status: z.string(),
  time_start: z.string().datetime().nullable(),
  time_end: z.string().datetime().nullable(),
  duration_ms: z.number().int().nullable(),
  github_run_id: z.string().nullable(),
  github_run_url: z.string().url().nullable(),
  error_message: z.string().nullable(),
});

export const listSupabaseHealthChecksResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(healthCheckItemSchema),
    meta: z.object({
      limit: z.number().int(),
      next_cursor: z.string().nullable(),
      has_more: z.boolean(),
    }),
  })
  .openapi('ListSupabaseHealthChecksResponse');

export type ListSupabaseHealthChecksQuery = z.infer<typeof listSupabaseHealthChecksQuerySchema>;
