import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';

/**
 * Jejak backup full DB (repo sambasku/sqlite).
 * Ditulis oleh script CI sqlite via DATABASE_URL - API hanya baca + trigger workflow.
 * Tanpa FK ke users (hapus akun / cron tidak memecah INSERT).
 */
export const databaseBackupLogs = sqliteTable(
  'database_backup_logs',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    triggeredByUserId: text('triggered_by_user_id'),
    triggeredByUsername: text('triggered_by_username'),
    /** console | schedule | manual */
    triggerSource: text('trigger_source').notNull().default('console'),
    dryRun: integer('dry_run', { mode: 'boolean' }).notNull().default(false),
    /** running | succeeded | failed */
    status: text('status').notNull(),
    timeStart: integer('time_start', { mode: 'timestamp' }),
    timeEnd: integer('time_end', { mode: 'timestamp' }),
    durationMs: integer('duration_ms'),
    sizeBytes: integer('size_bytes'),
    sha256: text('sha256'),
    databaseLabel: text('database_label'),
    assetName: text('asset_name'),
    releaseUrl: text('release_url'),
    githubReleaseTag: text('github_release_tag'),
    githubRunId: text('github_run_id'),
    githubRunUrl: text('github_run_url'),
    errorMessage: text('error_message'),
  },
  (t) => [
    index('database_backup_logs_created_idx').on(t.createdAt),
    index('database_backup_logs_status_created_idx').on(t.status, t.createdAt),
  ],
);
