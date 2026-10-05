import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';

/**
 * Jejak ping keep-alive Supabase (workflow ci/supabase di repo api).
 * Ditulis oleh script CI via DATABASE_URL - API hanya baca.
 * Tujuan: bukti project tidak idle + riwayat health di console System > Supabase.
 * Tanpa FK ke users (CI berjalan sebagai user sistem GitHub Actions).
 */
export const supabaseHealthChecks = sqliteTable(
  'supabase_health_checks',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    /** sambasku-staging | sambasku-prod */
    projectLabel: text('project_label').notNull(),
    /** ref 22 char dari subdomain .supabase.co */
    projectRef: text('project_ref').notNull(),
    /** staging | production */
    env: text('env').notNull().default('staging'),
    httpStatus: integer('http_status'),
    /** ok | failed */
    status: text('status').notNull(),
    timeStart: integer('time_start', { mode: 'timestamp' }),
    timeEnd: integer('time_end', { mode: 'timestamp' }),
    durationMs: integer('duration_ms'),
    githubRunId: text('github_run_id'),
    githubRunUrl: text('github_run_url'),
    errorMessage: text('error_message'),
  },
  (t) => [index('supabase_health_checks_env_created_idx').on(t.env, t.createdAt)],
);
