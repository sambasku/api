import { z } from '@hono/zod-openapi';

export const triggerBackupBodySchema = z
  .object({
    dry_run: z.boolean().optional().default(false),
  })
  .openapi('TriggerSqliteBackupBody');

export const triggerBackupResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      accepted: z.literal(true),
      workflow: z.string(),
      ref: z.string(),
      dry_run: z.boolean(),
      html_url: z.string().url(),
    }),
  })
  .openapi('TriggerSqliteBackupResponse');

export const listBackupLogsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    cursor: z.string().length(26).optional(),
  })
  .openapi('ListDatabaseBackupLogsQuery');

const backupLogItemSchema = z.object({
  id: z.string(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  triggered_by_user_id: z.string().nullable(),
  triggered_by_username: z.string().nullable(),
  trigger_source: z.string(),
  dry_run: z.boolean(),
  status: z.string(),
  time_start: z.string().datetime().nullable(),
  time_end: z.string().datetime().nullable(),
  duration_ms: z.number().int().nullable(),
  size_bytes: z.number().int().nullable(),
  sha256: z.string().nullable(),
  database_label: z.string().nullable(),
  asset_name: z.string().nullable(),
  release_url: z.string().nullable(),
  github_release_tag: z.string().nullable(),
  github_run_id: z.string().nullable(),
  github_run_url: z.string().nullable(),
  error_message: z.string().nullable(),
});

export const listBackupLogsResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(backupLogItemSchema),
    meta: z.object({
      limit: z.number().int(),
      next_cursor: z.string().nullable(),
      has_more: z.boolean(),
    }),
  })
  .openapi('ListDatabaseBackupLogsResponse');

export type TriggerBackupBody = z.infer<typeof triggerBackupBodySchema>;
export type ListBackupLogsQuery = z.infer<typeof listBackupLogsQuerySchema>;
