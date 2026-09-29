import type { DatabaseBackupLogRepository } from '../../domain/repositories/database-backup-log.repository';

export class ListDatabaseBackupLogsUseCase {
  constructor(private readonly repo: DatabaseBackupLogRepository) {}

  async execute(input: { limit: number; cursor?: string }) {
    return this.repo.list({
      limit: input.limit,
      cursor: input.cursor,
    });
  }
}
