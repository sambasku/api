import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { users, words } from './index';

/**
 * Header pengajuan impor dari web importer (petugas publik, tanpa login).
 * Satu baris = satu kirim. Baris detail ada di `web_import_details`.
 */
export const webImports = sqliteTable(
  'web_imports',
  {
    id: text('id').primaryKey(),
    /** Selalu WEB_IMPORT_USER_ID (user sistem) - web importer tidak login. */
    submittedBy: text('submitted_by')
      .notNull()
      .references(() => users.id),
    /** Nama petugas/pengumpul data - diisi manual di form atas web importer. */
    officerName: text('officer_name').notNull(),
    sourceLabel: text('source_label'),
    supportName: text('support_name'),
    /** web | book | article | other */
    supportType: text('support_type'),
    supportAddress: text('support_address'),
    supportTitle: text('support_title'),
    supportDesc: text('support_desc'),
    /** pending_review | approved | rejected | processing | completed | failed */
    status: text('status').notNull().default('pending_review'),
    totalRows: integer('total_rows').notNull().default(0),
    reviewedBy: text('reviewed_by').references(() => users.id),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
    reviewNote: text('review_note'),
    errorMessage: text('error_message'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    index('web_imports_status_idx').on(t.status),
    index('web_imports_status_created_idx').on(t.status, t.id),
  ],
);

/**
 * Baris lemma dalam satu pengajuan web importer. Kolom mengikuti format
 * CSV `kata,terjemahan,penjelasan_arti,type,contoh,arti_contoh`.
 */
export const webImportDetails = sqliteTable(
  'web_import_details',
  {
    id: text('id').primaryKey(),
    importId: text('import_id')
      .notNull()
      .references(() => webImports.id),
    rowNumber: integer('row_number').notNull(),
    kata: text('kata').notNull(),
    terjemahan: text('terjemahan'),
    penjelasanArti: text('penjelasan_arti'),
    type: text('type'),
    contoh: text('contoh'),
    artiContoh: text('arti_contoh'),
    /** pending | approved | rejected | skipped */
    status: text('status').notNull().default('pending'),
    adminNote: text('admin_note'),
    /** created | meanings_added | skipped | invalid | null */
    outcome: text('outcome'),
    outcomeMessage: text('outcome_message'),
    wordId: text('word_id').references(() => words.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    index('web_import_details_import_idx').on(t.importId),
    index('web_import_details_import_row_idx').on(t.importId, t.rowNumber),
  ],
);
