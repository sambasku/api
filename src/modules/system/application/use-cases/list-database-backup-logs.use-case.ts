import type { DatabaseBackupLogRepository } from '../../domain/repositories/database-backup-log.repository';
import { BACKUP_STALE_MESSAGE, BACKUP_STALE_MS } from './trigger-sqlite-backup.use-case';

export class ListDatabaseBackupLogsUseCase {
  constructor(private readonly repo: DatabaseBackupLogRepository) {}

  async execute(input: { limit: number; cursor?: string }) {
    // ponytail: sweep stale saat baca, bukan cron. Ceiling: baris baru berubah failed
    // saat halaman dibuka / backup di-trigger. Upgrade: cron Worker bila perlu notifikasi.
    await this.repo.failStale(new Date(Date.now() - BACKUP_STALE_MS), BACKUP_STALE_MESSAGE);
    return this.repo.list({
      limit: input.limit,
      cursor: input.cursor,
    });
  }
}
