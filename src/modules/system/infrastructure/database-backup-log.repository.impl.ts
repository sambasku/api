import { desc, lt } from 'drizzle-orm';
import { databaseBackupLogs } from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type {
  DatabaseBackupLog,
  DatabaseBackupLogFilter,
  DatabaseBackupLogPage,
  DatabaseBackupLogRepository,
} from '../domain/repositories/database-backup-log.repository';

function toEntity(row: typeof databaseBackupLogs.$inferSelect): DatabaseBackupLog {
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    triggeredByUserId: row.triggeredByUserId,
    triggeredByUsername: row.triggeredByUsername,
    triggerSource: row.triggerSource,
    dryRun: row.dryRun,
    status: row.status,
    timeStart: row.timeStart,
    timeEnd: row.timeEnd,
    durationMs: row.durationMs,
    sizeBytes: row.sizeBytes,
    sha256: row.sha256,
    databaseLabel: row.databaseLabel,
    assetName: row.assetName,
    releaseUrl: row.releaseUrl,
    githubReleaseTag: row.githubReleaseTag,
    githubRunId: row.githubRunId,
    githubRunUrl: row.githubRunUrl,
    errorMessage: row.errorMessage,
  };
}

export class DatabaseBackupLogRepositoryImpl implements DatabaseBackupLogRepository {
  constructor(private readonly db: AppDatabase) {}

  async list(filter: DatabaseBackupLogFilter): Promise<DatabaseBackupLogPage> {
    const rows = await this.db
      .select()
      .from(databaseBackupLogs)
      .where(filter.cursor ? lt(databaseBackupLogs.id, filter.cursor) : undefined)
      .orderBy(desc(databaseBackupLogs.id))
      .limit(filter.limit + 1);

    const hasMore = rows.length > filter.limit;
    const page = (hasMore ? rows.slice(0, filter.limit) : rows).map(toEntity);

    return {
      items: page,
      nextCursor: hasMore && page.length > 0 ? page[page.length - 1].id : null,
      hasMore,
    };
  }
}
