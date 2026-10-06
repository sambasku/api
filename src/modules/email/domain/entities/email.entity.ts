export type EmailCategory =
  | 'otp'
  | 'reset_password'
  | 'account_deletion'
  | 'verifier_approved'
  | 'test';

export type EmailLogStatus = 'sent' | 'failed' | 'skipped_quota' | 'skipped_env';

export interface EmailLog {
  id: string;
  provider: string;
  category: EmailCategory;
  toEmail: string;
  status: EmailLogStatus;
  errorCode: string | null;
  errorMessage: string | null;
  providerMessageId: string | null;
  createdAt: Date;
}

/** Baris kuota provider + pemakaian terhitung (bulan & hari berjalan). */
export interface EmailQuotaWithUsage {
  provider: string;
  monthlyLimit: number;
  dailyLimit: number;
  manualMonthlyUsed: number;
  /** manual used yang berlaku (0 kalau manual_month bukan bulan berjalan) */
  manualUsedEffective: number;
  priority: number;
  active: boolean;
  /** SUM usage harian bulan berjalan (tanpa manual) */
  apiMonthUsed: number;
  todayUsed: number;
  updatedAt: Date | null;
}

/** Nama provider aktif sekarang - urutan = seed default failover. */
export const EMAIL_PROVIDERS = ['resend'] as const;
export type EmailProvider = (typeof EMAIL_PROVIDERS)[number];
