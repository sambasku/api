import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';

/**
 * Quota per provider email (resend dulu, brevo nanti).
 * Provider tanpa baris = nonaktif (fail-closed per provider).
 */
export const emailQuotas = sqliteTable('email_quotas', {
  provider: text('provider').primaryKey(),
  monthlyLimit: integer('monthly_limit').notNull(),
  dailyLimit: integer('daily_limit').notNull(),
  manualMonthlyUsed: integer('manual_monthly_used').default(0).notNull(),
  manualMonth: text('manual_month').notNull().default(''),
  priority: integer('priority').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
});

/**
 * Usage per hari per provider (reset bulanan struktural).
 * Unique (provider, day) - overshot kecil (1-2) ditoleransi (ponytail: advisory lock).
 */
export const emailUsageDaily = sqliteTable('email_usage_daily', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  provider: text('provider').notNull().references(() => emailQuotas.provider),
  day: text('day').notNull(), // 'YYYY-MM-DD' UTC
  sentCount: integer('sent_count').notNull().default(0),
}, (t) => ({
  uniqueProviderDay: unique().on(t.provider, t.day),
}));

/**
 * Log status email (tanpa isi/subject - sesuai issue #16).
 * Category 'test' untuk playground, lainnya dari use case auth.
 */
export const emailLogs = sqliteTable('email_logs', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  provider: text('provider').notNull(),
  toEmail: text('to_email').notNull(),
  category: text('category', {
    enum: ['otp', 'reset_password', 'account_deletion', 'verifier_approved', 'test'],
  }).notNull(),
  status: text('status', {
    enum: ['sent', 'failed', 'skipped_quota'],
  }).notNull(),
  errorCode: text('error_code').default(''),
  errorMessage: text('error_message').default(''),
  providerMessageId: text('provider_message_id').default(''),
});