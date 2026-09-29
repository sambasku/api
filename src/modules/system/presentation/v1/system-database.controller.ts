import type { Context } from 'hono';
import { UnauthorizedError } from '@/shared/errors/app-error';
import type { AppVariables, AuthUser } from '@/shared/types';
import type { TriggerSqliteBackupUseCase } from '../../application/use-cases/trigger-sqlite-backup.use-case';
import type { ListDatabaseBackupLogsUseCase } from '../../application/use-cases/list-database-backup-logs.use-case';
import type { DatabaseBackupLog } from '../../domain/repositories/database-backup-log.repository';
import type {
  ListBackupLogsQuery,
  TriggerBackupBody,
} from './validators/system-database.validator';

type AdminCtx = Context<{ Variables: AppVariables }>;

function iso(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

function toWire(row: DatabaseBackupLog) {
  return {
    id: row.id,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    triggered_by_user_id: row.triggeredByUserId,
    triggered_by_username: row.triggeredByUsername,
    trigger_source: row.triggerSource,
    dry_run: row.dryRun,
    status: row.status,
    time_start: iso(row.timeStart),
    time_end: iso(row.timeEnd),
    duration_ms: row.durationMs,
    size_bytes: row.sizeBytes,
    sha256: row.sha256,
    database_label: row.databaseLabel,
    asset_name: row.assetName,
    release_url: row.releaseUrl,
    github_release_tag: row.githubReleaseTag,
    github_run_id: row.githubRunId,
    github_run_url: row.githubRunUrl,
    error_message: row.errorMessage,
  };
}

export class SystemDatabaseController {
  constructor(
    private readonly deps: {
      trigger: TriggerSqliteBackupUseCase;
      list: ListDatabaseBackupLogsUseCase;
    },
  ) {}

  async triggerBackup(c: AdminCtx, body: TriggerBackupBody) {
    const user = this.requireUser(c);
    const data = await this.deps.trigger.execute({
      dryRun: body.dry_run ?? false,
      actorUserId: user.user_id,
      triggerSource: 'console',
    });
    return c.json({ success: true as const, data }, 202);
  }

  async listBackups(c: AdminCtx, query: ListBackupLogsQuery) {
    const page = await this.deps.list.execute({
      limit: query.limit,
      cursor: query.cursor,
    });
    return c.json({
      success: true as const,
      data: page.items.map(toWire),
      meta: {
        limit: query.limit,
        next_cursor: page.nextCursor,
        has_more: page.hasMore,
      },
    });
  }

  private requireUser(c: AdminCtx): AuthUser {
    const user = c.get('user');
    if (!user) throw new UnauthorizedError();
    return user;
  }
}
