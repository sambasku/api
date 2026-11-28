import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';
import { cashTransactions } from './cash-ledger.schema';

export const CASH_ATTACHMENT_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
export type CashAttachmentMime = (typeof CASH_ATTACHMENT_MIME)[number];

/**
 * Lampiran bukti transaksi cashflow. Objek ada di R2 privat (`object_key` acak).
 * Ledger tidak diubah: lampiran ditempel sebagai baris ini, bukan kolom di cash_transactions.
 */
export const cashAttachments = sqliteTable(
  'cash_attachments',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    transactionId: text('transaction_id')
      .notNull()
      .references(() => cashTransactions.id),
    objectKey: text('object_key').notNull(),
    originalName: text('original_name').notNull(),
    mime: text('mime').$type<CashAttachmentMime>().notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    sha256: text('sha256').notNull(),
    uploadedBy: text('uploaded_by').references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
    deletedBy: text('deleted_by').references(() => users.id),
  },
  (t) => [
    check('cash_attachments_size_chk', sql`${t.sizeBytes} > 0`),
    check(
      'cash_attachments_mime_chk',
      sql`${t.mime} IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')`,
    ),
    uniqueIndex('cash_attachments_object_key_uq').on(t.objectKey),
    index('cash_attachments_tx_idx').on(t.transactionId),
    uniqueIndex('cash_attachments_tx_sha_uq')
      .on(t.transactionId, t.sha256)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
);
