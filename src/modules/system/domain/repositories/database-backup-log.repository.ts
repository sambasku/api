export type DatabaseBackupLogStatus = 'running' | 'succeeded' | 'failed';
export type DatabaseBackupTriggerSource = 'console' | 'schedule' | 'manual';

export interface DatabaseBackupLog {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  triggeredByUserId: string | null;
  triggeredByUsername: string | null;
  triggerSource: string;
  dryRun: boolean;
  status: string;
  timeStart: Date | null;
  timeEnd: Date | null;
  durationMs: number | null;
  sizeBytes: number | null;
  sha256: string | null;
  databaseLabel: string | null;
  assetName: string | null;
  releaseUrl: string | null;
  githubReleaseTag: string | null;
  githubRunId: string | null;
  githubRunUrl: string | null;
  errorMessage: string | null;
}

export interface DatabaseBackupLogFilter {
  limit: number;
  cursor?: string;
}

export interface DatabaseBackupLogPage {
  items: DatabaseBackupLog[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface DatabaseBackupLogRepository {
  list(filter: DatabaseBackupLogFilter): Promise<DatabaseBackupLogPage>;
}
