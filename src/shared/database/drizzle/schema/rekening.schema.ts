import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';

export const REKENING_JENIS = ['bank', 'tunai', 'dompet'] as const;
export type RekeningJenis = (typeof REKENING_JENIS)[number];

/** Tempat uang disimpan. Saldo dihitung dari transaksi, tidak disimpan. */
export const rekening = sqliteTable(
  'rekening',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    nama: text('nama').notNull(),
    jenis: text('jenis').$type<RekeningJenis>().notNull(),
    /** Saldo sebelum transaksi pertama, integer rupiah. */
    saldoAwal: integer('saldo_awal').notNull().default(0),
    aktif: integer('aktif', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [check('rekening_jenis_chk', sql`${t.jenis} IN ('bank', 'tunai', 'dompet')`)],
);

/** Hasil pencocokan saldo ledger dengan saldo bank pada tanggal tertentu. */
export const rekonsiliasi = sqliteTable('rekonsiliasi', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  rekeningId: text('rekening_id')
    .notNull()
    .references(() => rekening.id),
  /** ISO date YYYY-MM-DD. */
  tanggal: text('tanggal').notNull(),
  saldoBank: integer('saldo_bank').notNull(),
  saldoLedger: integer('saldo_ledger').notNull(),
  /** saldoBank - saldoLedger. Harus dijelaskan dengan transaksi biaya atau bunga. */
  selisih: integer('selisih').notNull(),
  catatan: text('catatan').notNull().default(''),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
