import type { EmailCategory, EmailLog, EmailLogStatus, EmailQuotaWithUsage } from '../entities/email.entity';

export interface EmailLogEntry {
  provider: string;
  category: EmailCategory;
  toEmail: string;
  status: EmailLogStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
  providerMessageId?: string | null;
}

export interface EmailLogListQuery {
  limit?: number;
  cursor?: string | null;
  status?: EmailLogStatus;
  provider?: string;
}

export interface EmailQuotaUpdateInput {
  monthlyLimit?: number;
  dailyLimit?: number;
  /** Set manual_used + tandai manual_month = bulan berjalan. */
  manualMonthlyUsed?: number;
  active?: boolean;
  priority?: number;
}

export interface EmailQuotaRepository {
  /** Baris kuota urut priority (aktif duluan, lalu inactive), + usage terhitung. */
  listWithUsage(now: Date): Promise<EmailQuotaWithUsage[]>;
  getOne(provider: string, now: Date): Promise<EmailQuotaWithUsage | null>;
  update(provider: string, input: EmailQuotaUpdateInput, actorId: string): Promise<void>;
}

export interface EmailUsageRepository {
  /**
   * Increment atomik usage harian (bucket UTC). Race-safe: ON CONFLICT
   * DO UPDATE sent_count = sent_count + 1. Aman lintas tier (satu Turso).
   */
  increment(provider: string, now: Date): Promise<void>;
  /** Hapus baris usage lebih lama dari cutoff (cron pruning). */
  pruneOlderThan(cutoffDay: string): Promise<void>;
}

export interface EmailLogRepository {
  record(entry: EmailLogEntry): Promise<void>;
  list(query: EmailLogListQuery): Promise<{ items: EmailLog[]; nextCursor: string | null }>;
  pruneOlderThan(cutoff: Date): Promise<void>;
}
