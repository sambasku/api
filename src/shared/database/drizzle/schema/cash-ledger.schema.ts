import { sql } from 'drizzle-orm';
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';
import { kategoriTransaksi } from './kategori-transaksi.schema';
import { rekening } from './rekening.schema';
import { kewajiban } from './kewajiban.schema';

export const CASH_TRANSAKSI_TIPE = ['masuk', 'keluar'] as const;
export type CashTransaksiTipe = (typeof CASH_TRANSAKSI_TIPE)[number];

export const CASH_DONATUR_TIPE = ['perorangan', 'usaha'] as const;
export type CashDonaturTipe = (typeof CASH_DONATUR_TIPE)[number];

/** Transaksi sistem yang tidak memakai master kategori. */
export const CASH_KATEGORI_SISTEM = [
  'talangan',
  'reimburse',
  'refund',
  'reversal',
  'transfer',
] as const;
export type CashKategoriSistem = (typeof CASH_KATEGORI_SISTEM)[number];

/**
 * Ledger kas. APPEND-ONLY: baris tidak pernah di-UPDATE atau DELETE (dijaga trigger).
 * Koreksi lewat baris reversal baru yang menunjuk `dibatalkan_dari_id`.
 * Guard saldo, sisa loan, dan sisa refund dijaga trigger di migrasi 0207.
 */
export const cashTransactions = sqliteTable(
  'cash_transactions',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    tipe: text('tipe').$type<CashTransaksiTipe>().notNull(),
    /** Terisi untuk transaksi manual (master kategori). Tepat satu dari kategoriId / kategoriSistem. */
    kategoriId: text('kategori_id').references(() => kategoriTransaksi.id),
    kategoriSistem: text('kategori_sistem').$type<CashKategoriSistem>(),
    /** Integer rupiah, selalu positif. Arah ditentukan `tipe`. */
    nominal: integer('nominal').notNull(),
    /** ISO date YYYY-MM-DD, tanggal kejadian (boleh mundur). */
    tanggal: text('tanggal').notNull(),
    catatan: text('catatan').notNull().default(''),
    rekeningId: text('rekening_id')
      .notNull()
      .references(() => rekening.id),
    loanId: text('loan_id').references((): AnySQLiteColumn => loans.id),
    kewajibanId: text('kewajiban_id').references(() => kewajiban.id),
    /** Periode kewajiban, format YYYY-MM. */
    periode: text('periode'),
    dibatalkanDariId: text('dibatalkan_dari_id').references(
      (): AnySQLiteColumn => cashTransactions.id,
    ),
    alasanKoreksi: text('alasan_koreksi'),
    refundDariId: text('refund_dari_id').references((): AnySQLiteColumn => cashTransactions.id),
    transferPairId: text('transfer_pair_id'),
    penerimaNama: text('penerima_nama'),
    penerimaUserId: text('penerima_user_id').references(() => users.id),
    buktiUrl: text('bukti_url'),
    /** Pajak yang dipotong dari bruto, integer rupiah. Disetor sebagai transaksi terpisah. */
    pajakDipotong: integer('pajak_dipotong'),
    donaturNama: text('donatur_nama'),
    /**
     * Jenis donatur/sponsor: perorangan atau usaha. NULL = anonim.
     * `donatur_user_id` / `donatur_usaha_id` sengaja TANPA FK: ledger append-only,
     * jadi FK restrict akan memblokir penghapusan akun/usaha, dan SET NULL ditolak trigger.
     * Nama tetap tersimpan sebagai snapshot di `donatur_nama`.
     */
    donaturTipe: text('donatur_tipe').$type<CashDonaturTipe>(),
    donaturUserId: text('donatur_user_id'),
    donaturUsahaId: text('donatur_usaha_id'),
    tampilPublik: integer('tampil_publik', { mode: 'boolean' }).notNull().default(false),
    /** Kunci submit dari client. Mencegah input ganda saat double-submit. */
    idempotencyKey: text('idempotency_key'),
    createdBy: text('created_by').references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    check('cash_tx_tipe_chk', sql`${t.tipe} IN ('masuk', 'keluar')`),
    check('cash_tx_nominal_chk', sql`${t.nominal} > 0`),
    check(
      'cash_tx_sistem_chk',
      sql`${t.kategoriSistem} IS NULL OR ${t.kategoriSistem} IN ('talangan', 'reimburse', 'refund', 'reversal', 'transfer')`,
    ),
    check(
      'cash_tx_kategori_xor_chk',
      sql`(${t.kategoriId} IS NULL) <> (${t.kategoriSistem} IS NULL)`,
    ),
    check('cash_tx_pajak_chk', sql`${t.pajakDipotong} IS NULL OR ${t.pajakDipotong} >= 0`),
    check(
      'cash_tx_publik_nama_chk',
      sql`${t.tampilPublik} = 0 OR ${t.donaturNama} IS NOT NULL`,
    ),
    check(
      'cash_tx_donatur_tipe_chk',
      sql`${t.donaturTipe} IS NULL OR ${t.donaturTipe} IN ('perorangan', 'usaha')`,
    ),
    uniqueIndex('cash_tx_dibatalkan_dari_uidx')
      .on(t.dibatalkanDariId)
      .where(sql`dibatalkan_dari_id IS NOT NULL`),
    uniqueIndex('cash_tx_idempotency_uidx')
      .on(t.idempotencyKey)
      .where(sql`idempotency_key IS NOT NULL`),
    index('cash_tx_rekening_idx').on(t.rekeningId),
    index('cash_tx_loan_idx').on(t.loanId),
    index('cash_tx_kewajiban_periode_idx').on(t.kewajibanId, t.periode),
    index('cash_tx_refund_dari_idx').on(t.refundDariId),
    index('cash_tx_tanggal_idx').on(t.tanggal),
  ],
);

/**
 * Talangan: satu baris per penalang. Status (outstanding / lunas / dihibahkan)
 * diturunkan dari total reimburse dan kolom hibah / batal, bukan disimpan.
 */
export const loans = sqliteTable(
  'loans',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    penalangUserId: text('penalang_user_id').references(() => users.id, { onDelete: 'set null' }),
    /** Snapshot nama, tetap ada walau akun penalang dihapus. */
    penalangNama: text('penalang_nama').notNull(),
    pokok: integer('pokok').notNull(),
    /** Transaksi keluar yang dibiayai talangan ini. */
    pengeluaranTxId: text('pengeluaran_tx_id')
      .notNull()
      .references((): AnySQLiteColumn => cashTransactions.id),
    tanggalTalangan: text('tanggal_talangan').notNull(),
    dihibahkanAt: integer('dihibahkan_at', { mode: 'timestamp' }),
    catatanHibah: text('catatan_hibah'),
    dibatalkanAt: integer('dibatalkan_at', { mode: 'timestamp' }),
    /** Optimistic lock: naik setiap perubahan status loan. */
    version: integer('version').notNull().default(0),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    check('loans_pokok_chk', sql`${t.pokok} > 0`),
    index('loans_pengeluaran_idx').on(t.pengeluaranTxId),
  ],
);
