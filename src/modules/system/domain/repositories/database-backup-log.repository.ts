/** `running` = legacy (sebelum API insert di awal); sekarang pending -> processing -> final. */
export type DatabaseBackupLogStatus = 'pending' | 'processing' | 'running' | 'succeeded' | 'failed';
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

export interface CreateDatabaseBackupLogInput {
  triggeredByUserId: string | null;
  triggeredByUsername: string | null;
  triggerSource: DatabaseBackupTriggerSource;
  dryRun: boolean;
  status: DatabaseBackupLogStatus;
  timeStart: Date;
}

export interface DatabaseBackupLogRepository {
  list(filter: DatabaseBackupLogFilter): Promise<DatabaseBackupLogPage>;
  create(input: CreateDatabaseBackupLogInput): Promise<DatabaseBackupLog>;
  updateStatus(id: string, status: DatabaseBackupLogStatus, errorMessage?: string): Promise<void>;
  /** Baris terbaru yang masih pending/processing/running. */
  findActive(): Promise<DatabaseBackupLog | null>;
  /** Tandai failed baris aktif yang dibuat sebelum `olderThan`. */
  failStale(olderThan: Date, errorMessage: string): Promise<void>;
}
