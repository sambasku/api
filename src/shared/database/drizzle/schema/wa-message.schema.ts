import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';

/**
 * Template pesan WhatsApp per event (mis. verifier_application_approved).
 * `body` = source of truth isi pesan dengan placeholder {{namaParam}};
 * dikirim sebagai Meta-approved template (meta_template_name) dengan
 * positional parameters mengikuti urutan `params`.
 */
export const waMessageTemplates = sqliteTable(
  'wa_message_templates',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    /** Nama event unik: verifier_application_approved | verifier_application_rejected | ... */
    eventKey: text('event_key').notNull(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
    metaTemplateName: text('meta_template_name').notNull(),
    metaTemplateLanguage: text('meta_template_language').notNull().default('id'),
    /** Teks pesan dengan placeholder {{param}} - tampil di console, di-render saat kirim. */
    body: text('body').notNull(),
    /** Daftar parameter bernama: [{ name, description }] - urutan = urutan positional Meta. */
    params: text('params', { mode: 'json' })
      .$type<Array<{ name: string; description: string }>>()
      .notNull()
      .default(sql`'[]'`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
    updatedBy: text('updated_by').references(() => users.id),
  },
  (t) => [uniqueIndex('wa_message_templates_event_key_unique').on(t.eventKey)],
);

/** Log generik semua kirim WA (notif sistem + test admin). */
export const waMessageLogs = sqliteTable(
  'wa_message_logs',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    /** kapso | provider lain nanti */
    provider: text('provider').notNull(),
    /** verifier_application_approved | verifier_application_rejected | test */
    eventKey: text('event_key').notNull(),
    toPhone: text('to_phone').notNull(),
    templateName: text('template_name'),
    /** template | text */
    channel: text('channel').notNull(),
    /** sent | failed */
    status: text('status').notNull(),
    errorMessage: text('error_message'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [index('wa_message_logs_created_at_idx').on(t.createdAt)],
);

/**
 * Pemakaian kuota per provider. Reset used_count tiap awal bulan
 * (cron + lazy reset di repository). Admin bisa koreksi manual karena
 * kirim dari dashboard Kapso tidak lewat API ini.
 */
export const waUsage = sqliteTable('wa_usage', {
  provider: text('provider').primaryKey(),
  usedCount: integer('used_count').notNull().default(0),
  limitCount: integer('limit_count').notNull().default(2000),
  warnThresholdPercent: integer('warn_threshold_percent').notNull().default(80),
  /** Awal periode kuota berjalan - dipakai reset bulanan. */
  periodStart: integer('period_start', { mode: 'timestamp' }).notNull().$defaultFn(
    () => new Date(),
  ),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
  updatedBy: text('updated_by').references(() => users.id),
});
