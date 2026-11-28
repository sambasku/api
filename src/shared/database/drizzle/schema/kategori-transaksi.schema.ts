import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';

export const KATEGORI_TRANSAKSI_TIPE = ['masuk', 'keluar'] as const;
export type KategoriTransaksiTipe = (typeof KATEGORI_TRANSAKSI_TIPE)[number];

/**
 * Master kategori cashflow (satu tabel, dua tipe: masuk | keluar).
 * Tidak pernah dihapus - cukup dinonaktifkan, karena transaksi lama masih merujuknya.
 */
export const kategoriTransaksi = sqliteTable(
  'kategori_transaksi',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    kode: text('kode').notNull(),
    nama: text('nama').notNull(),
    tipe: text('tipe').$type<KategoriTransaksiTipe>().notNull(),
    aktif: integer('aktif', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex('kategori_transaksi_kode_uidx').on(t.kode),
    check('kategori_transaksi_tipe_chk', sql`${t.tipe} IN ('masuk', 'keluar')`),
  ],
);
