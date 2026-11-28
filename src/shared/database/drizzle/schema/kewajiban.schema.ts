import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';
import { kategoriTransaksi } from './kategori-transaksi.schema';

export const KEWAJIBAN_RECURRENCE = ['sekali', 'bulanan', 'tahunan'] as const;
export type KewajibanRecurrence = (typeof KEWAJIBAN_RECURRENCE)[number];

/**
 * Beban berulang (listrik, domain, langganan). Pengingat saja: tidak mengubah saldo.
 * Pembayaran per periode dicatat sebagai transaksi keluar dengan `kewajiban_id`.
 */
export const kewajiban = sqliteTable(
  'kewajiban',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    nama: text('nama').notNull(),
    /** Estimasi per periode, integer rupiah. Dipakai untuk menentukan status lunas. */
    nominalEstimasi: integer('nominal_estimasi').notNull(),
    kategoriId: text('kategori_id')
      .notNull()
      .references(() => kategoriTransaksi.id),
    recurrence: text('recurrence').$type<KewajibanRecurrence>().notNull(),
    /** Periode pertama, format YYYY-MM. Untuk tahunan, bulan di sini jadi bulan jatuh tempo. */
    periodeMulai: text('periode_mulai').notNull(),
    /** Hari jatuh tempo dalam bulan, 1-31. Bulan pendek dibulatkan ke akhir bulan. */
    hariJatuhTempo: integer('hari_jatuh_tempo').notNull(),
    aktif: integer('aktif', { mode: 'boolean' }).notNull().default(true),
    /** ISO date. Setelah tanggal ini tidak ada periode baru yang dibuat. */
    berhentiPer: text('berhenti_per'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    check('kewajiban_nominal_chk', sql`${t.nominalEstimasi} > 0`),
    check('kewajiban_recurrence_chk', sql`${t.recurrence} IN ('sekali', 'bulanan', 'tahunan')`),
    check('kewajiban_hari_chk', sql`${t.hariJatuhTempo} BETWEEN 1 AND 31`),
  ],
);
