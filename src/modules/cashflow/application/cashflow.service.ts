import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { AppDatabase, AppTransaction } from '@/shared/database/drizzle/client';
import {
  cashTransactions,
  kategoriTransaksi,
  kewajiban,
  loans as loansTable,
  rekening,
  rekonsiliasi,
  type CashKategoriSistem,
  type CashTransaksiTipe,
  type KategoriTransaksiTipe,
  type KewajibanRecurrence,
  type RekeningJenis,
} from '@/shared/database/drizzle/schema';
import { ConflictError, NotFoundError, ValidationError } from '@/shared/errors/app-error';
import { generateId } from '@/shared/utils/ulid';
import {
  addMonthsToPeriode,
  dueDate,
  generatePeriodes,
  isIsoDate,
  isOverdue,
  isPeriodeInSchedule,
  KODE_KATEGORI_JASA,
  periodeFromDate,
  periodeStatus,
  sisaPokok,
  todayJakarta,
  type PeriodeStatus,
} from '../domain/cashflow-rules';

type Tx = AppTransaction;
type CashRow = typeof cashTransactions.$inferSelect;
type KategoriRow = typeof kategoriTransaksi.$inferSelect;
type RekeningRow = typeof rekening.$inferSelect;
type KewajibanRow = typeof kewajiban.$inferSelect;

export interface LoanView {
  id: string;
  penalangUserId: string | null;
  penalangNama: string;
  pokok: number;
  reimbursed: number;
  sisa: number;
  tanggalTalangan: string;
  pengeluaranTxId: string;
  status: 'outstanding' | 'lunas' | 'dihibahkan' | 'dibatalkan';
  version: number;
}

export interface PengingatItem {
  kewajibanId: string;
  nama: string;
  periode: string;
  dueDate: string;
  nominalEstimasi: number;
  paid: number;
  sisa: number;
  status: PeriodeStatus;
  terlewat: boolean;
}

export interface SummaryRekening {
  id: string;
  nama: string;
  jenis: RekeningJenis;
  saldo: number;
}

export interface Summary {
  rekening: SummaryRekening[];
  kasFisik: number;
  sisaTalangan: number;
  saldoBersih: number;
}

export interface TalanganInput {
  penalangUserId?: string | null;
  penalangNama: string;
  pokok: number;
}

export interface TransaksiBase {
  rekeningId: string;
  nominal: number;
  tanggal: string;
  catatan?: string;
  idempotencyKey: string;
}

export interface KeluarInput extends TransaksiBase {
  kategoriId: string;
  penerimaNama?: string | null;
  penerimaUserId?: string | null;
  buktiUrl?: string | null;
  pajakDipotong?: number | null;
  talangan?: TalanganInput[];
}

export interface MasukInput extends TransaksiBase {
  kategoriId: string;
  donaturNama?: string | null;
  tampilPublik?: boolean;
}

/** Kode error trigger database -> pesan untuk user. Harus sama dengan migrasi 0207. */
const TRIGGER_ERRORS: Record<string, string> = {
  KAS_TIDAK_CUKUP: 'Kas rekening belum cukup untuk transaksi ini. Catat talangan atau tunggu dana masuk.',
  REIMBURSE_MELEBIHI_SISA: 'Nominal melebihi sisa talangan yang belum dikembalikan.',
  REFUND_MELEBIHI_DONASI: 'Nominal refund melebihi sisa donasi asal.',
  LOAN_TIDAK_AKTIF: 'Talangan ini sudah dihibahkan atau dibatalkan, jadi tidak bisa direimburse.',
  APPEND_ONLY: 'Riwayat transaksi tidak bisa diubah. Gunakan koreksi.',
  cash_tx_dibatalkan_dari_uidx: 'Transaksi ini sudah pernah dibatalkan.',
};

function collectMessages(err: unknown, depth = 0): string {
  if (depth > 3 || err == null) return '';
  if (typeof err === 'string') return err;
  const e = err as { message?: unknown; cause?: unknown };
  const own = typeof e.message === 'string' ? e.message : '';
  return `${own} ${collectMessages(e.cause, depth + 1)}`;
}

/** Terjemahkan error trigger/constraint database ke ConflictError yang punya kode bisnis. */
function mapDbError(err: unknown): never {
  if (err instanceof ConflictError || err instanceof NotFoundError || err instanceof ValidationError) {
    throw err;
  }
  const text = collectMessages(err);
  for (const [code, message] of Object.entries(TRIGGER_ERRORS)) {
    if (text.includes(code)) throw new ConflictError(code, message);
  }
  // Transaksi lain sedang memegang kunci tulis: minta user coba lagi, jangan 500.
  if (text.includes('SQLITE_BUSY') || text.includes('database is locked')) {
    throw new ConflictError('KONFLIK_DATA', 'Ada perubahan lain yang sedang berjalan. Coba lagi sebentar lagi.');
  }
  throw err;
}

function bad(field: string, message: string): never {
  throw new ValidationError([{ field, message }]);
}

function assertNominal(nominal: number): void {
  if (!Number.isSafeInteger(nominal) || nominal <= 0) {
    bad('nominal', 'Nominal harus bilangan bulat lebih dari 0.');
  }
}

function assertTanggal(tanggal: string): void {
  if (!isIsoDate(tanggal)) bad('tanggal', 'Tanggal harus format YYYY-MM-DD.');
}

export class CashflowService {
  constructor(private readonly db: AppDatabase) {}

  private run<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(fn).catch(mapDbError);
  }

  // ---------------------------------------------------------------- master

  async listKategori(): Promise<KategoriRow[]> {
    return this.db.select().from(kategoriTransaksi).orderBy(kategoriTransaksi.kode);
  }

  async createKategori(input: { kode: string; nama: string; tipe: KategoriTransaksiTipe }) {
    const row = {
      id: generateId(),
      kode: input.kode.trim().toUpperCase(),
      nama: input.nama.trim(),
      tipe: input.tipe,
      aktif: true,
    };
    if (!row.nama) bad('nama', 'Nama kategori wajib diisi.');
    try {
      await this.db.insert(kategoriTransaksi).values(row);
    } catch (err) {
      const text = collectMessages(err);
      if (text.includes('kategori_transaksi_kode_uidx') || text.includes('kategori_transaksi.kode')) {
        throw new ConflictError('KATEGORI_KODE_SUDAH_ADA', 'Kode kategori ini sudah dipakai.');
      }
      throw err;
    }
    const [created] = await this.db.select().from(kategoriTransaksi).where(eq(kategoriTransaksi.id, row.id));
    return created;
  }

  /** Kategori tidak dihapus. Nonaktifkan saja, supaya transaksi lama tetap bisa dibaca. */
  async updateKategori(id: string, patch: { nama?: string; aktif?: boolean }) {
    const set: Partial<typeof kategoriTransaksi.$inferInsert> = {};
    if (patch.nama !== undefined) set.nama = patch.nama.trim();
    if (patch.aktif !== undefined) set.aktif = patch.aktif;
    const [row] = await this.db
      .update(kategoriTransaksi)
      .set(set)
      .where(eq(kategoriTransaksi.id, id))
      .returning();
    if (!row) throw new NotFoundError('KATEGORI_TIDAK_DITEMUKAN', 'Kategori tidak ditemukan.');
    return row;
  }

  async listRekening(): Promise<RekeningRow[]> {
    return this.db.select().from(rekening).orderBy(rekening.nama);
  }

  async createRekening(input: { nama: string; jenis: RekeningJenis; saldoAwal: number }) {
    if (!input.nama.trim()) bad('nama', 'Nama rekening wajib diisi.');
    if (!Number.isSafeInteger(input.saldoAwal)) bad('saldo_awal', 'Saldo awal harus bilangan bulat.');
    const id = generateId();
    await this.db.insert(rekening).values({
      id,
      nama: input.nama.trim(),
      jenis: input.jenis,
      saldoAwal: input.saldoAwal,
      aktif: true,
    });
    const [row] = await this.db.select().from(rekening).where(eq(rekening.id, id));
    return row;
  }

  async updateRekening(id: string, patch: { nama?: string; aktif?: boolean }) {
    const set: Partial<typeof rekening.$inferInsert> = {};
    if (patch.nama !== undefined) set.nama = patch.nama.trim();
    if (patch.aktif !== undefined) set.aktif = patch.aktif;
    const [row] = await this.db.update(rekening).set(set).where(eq(rekening.id, id)).returning();
    if (!row) throw new NotFoundError('REKENING_TIDAK_DITEMUKAN', 'Rekening tidak ditemukan.');
    return row;
  }

  // ---------------------------------------------------------------- baca

  /** Ringkasan saldo. Tiga query: rekening, saldo per rekening, dan loan. */
  async getSummary(): Promise<Summary> {
    const rekeningRows = await this.db.select().from(rekening).orderBy(rekening.nama);
    const saldoRows = await this.db.all<{ rekening_id: string; saldo: number }>(sql`
      SELECT rekening_id, SUM(CASE WHEN tipe = 'masuk' THEN nominal ELSE -nominal END) AS saldo
      FROM cash_transactions GROUP BY rekening_id`);
    const saldoMap = new Map(saldoRows.map((r) => [r.rekening_id, Number(r.saldo)]));
    const rekeningSummary = rekeningRows.map((r) => ({
      id: r.id,
      nama: r.nama,
      jenis: r.jenis,
      saldo: r.saldoAwal + (saldoMap.get(r.id) ?? 0),
    }));
    const kasFisik = rekeningSummary.reduce((acc, r) => acc + r.saldo, 0);
    const loans = await this.loanViews(this.db);
    const sisaTalangan = loans
      .filter((l) => l.status === 'outstanding')
      .reduce((acc, l) => acc + l.sisa, 0);
    return {
      rekening: rekeningSummary,
      kasFisik,
      sisaTalangan,
      saldoBersih: kasFisik - sisaTalangan,
    };
  }

  async listTransaksi(limit: number): Promise<CashRow[]> {
    return this.db
      .select()
      .from(cashTransactions)
      .orderBy(desc(cashTransactions.createdAt), desc(cashTransactions.id))
      .limit(limit);
  }

  async listLoans(): Promise<LoanView[]> {
    return this.loanViews(this.db);
  }

  /** Satu query: loan + total reimburse bersih (reimburse - reversal reimburse). */
  private async loanViews(db: AppDatabase | Tx): Promise<LoanView[]> {
    const rows = await db.all<{
      id: string;
      penalang_user_id: string | null;
      penalang_nama: string;
      pokok: number;
      tanggal_talangan: string;
      pengeluaran_tx_id: string;
      dihibahkan_at: number | null;
      dibatalkan_at: number | null;
      version: number;
      reimbursed: number;
    }>(sql`
      SELECT l.id, l.penalang_user_id, l.penalang_nama, l.pokok, l.tanggal_talangan,
             l.pengeluaran_tx_id, l.dihibahkan_at, l.dibatalkan_at, l.version,
             COALESCE(SUM(CASE
               WHEN c.kategori_sistem = 'reimburse' THEN c.nominal
               WHEN c.kategori_sistem = 'reversal' AND c.tipe = 'masuk' THEN -c.nominal
               ELSE 0 END), 0) AS reimbursed
      FROM loans l
      LEFT JOIN cash_transactions c ON c.loan_id = l.id
      GROUP BY l.id
      ORDER BY l.created_at`);
    return rows.map((r) => {
      const reimbursed = Number(r.reimbursed);
      const pokok = Number(r.pokok);
      const sisa = sisaPokok(pokok, reimbursed);
      let status: LoanView['status'] = 'outstanding';
      if (r.dibatalkan_at != null) status = 'dibatalkan';
      else if (r.dihibahkan_at != null) status = 'dihibahkan';
      else if (sisa === 0) status = 'lunas';
      return {
        id: r.id,
        penalangUserId: r.penalang_user_id,
        penalangNama: r.penalang_nama,
        pokok,
        reimbursed,
        sisa,
        tanggalTalangan: r.tanggal_talangan,
        pengeluaranTxId: r.pengeluaran_tx_id,
        status,
        version: Number(r.version),
      };
    });
  }

  // ---------------------------------------------------------------- helper tx

  private async findByKey(tx: Tx, key: string): Promise<CashRow | null> {
    const [row] = await tx
      .select()
      .from(cashTransactions)
      .where(eq(cashTransactions.idempotencyKey, key))
      .limit(1);
    return row ?? null;
  }

  private async findCash(tx: Tx, id: string): Promise<CashRow> {
    const [row] = await tx.select().from(cashTransactions).where(eq(cashTransactions.id, id)).limit(1);
    if (!row) throw new NotFoundError('TRANSAKSI_TIDAK_DITEMUKAN', 'Transaksi tidak ditemukan.');
    return row;
  }

  private async requireRekeningAktif(tx: Tx, id: string): Promise<void> {
    const [row] = await tx
      .select({ aktif: rekening.aktif })
      .from(rekening)
      .where(eq(rekening.id, id))
      .limit(1);
    if (!row) throw new NotFoundError('REKENING_TIDAK_DITEMUKAN', 'Rekening tidak ditemukan.');
    if (!row.aktif) throw new ConflictError('REKENING_NONAKTIF', 'Rekening ini sudah dinonaktifkan.');
  }

  private async requireKategori(tx: Tx, id: string, tipe: CashTransaksiTipe): Promise<KategoriRow> {
    const [row] = await tx.select().from(kategoriTransaksi).where(eq(kategoriTransaksi.id, id)).limit(1);
    if (!row) throw new NotFoundError('KATEGORI_TIDAK_DITEMUKAN', 'Kategori tidak ditemukan.');
    if (row.tipe !== tipe) {
      throw new ConflictError('KATEGORI_TIPE_SALAH', 'Kategori ini tidak sesuai dengan jenis transaksi.');
    }
    if (!row.aktif) throw new ConflictError('KATEGORI_NONAKTIF', 'Kategori ini sudah dinonaktifkan.');
    return row;
  }

  /** Saldo rekening = saldo awal + masuk - keluar, sampai tanggal (inklusif) jika diberikan. */
  private async saldoRekening(tx: Tx, rekeningId: string, sampaiTanggal?: string): Promise<number> {
    const filter = sampaiTanggal ? sql` AND tanggal <= ${sampaiTanggal}` : sql``;
    const rows = await tx.all<{ saldo: number }>(sql`
      SELECT (SELECT saldo_awal FROM rekening WHERE id = ${rekeningId})
        + COALESCE((SELECT SUM(CASE WHEN tipe = 'masuk' THEN nominal ELSE -nominal END)
                    FROM cash_transactions WHERE rekening_id = ${rekeningId}${filter}), 0) AS saldo`);
    return Number(rows[0]?.saldo ?? 0);
  }

  private async isReversed(tx: Tx, id: string): Promise<boolean> {
    const [row] = await tx
      .select({ id: cashTransactions.id })
      .from(cashTransactions)
      .where(eq(cashTransactions.dibatalkanDariId, id))
      .limit(1);
    return !!row;
  }

  private async findLoan(tx: Tx, id: string): Promise<LoanView> {
    const views = await this.loanViews(tx);
    const view = views.find((v) => v.id === id);
    if (!view) throw new NotFoundError('LOAN_TIDAK_DITEMUKAN', 'Talangan tidak ditemukan.');
    return view;
  }

  private async insertCash(
    tx: Tx,
    row: Partial<typeof cashTransactions.$inferInsert> &
      Pick<typeof cashTransactions.$inferInsert, 'tipe' | 'nominal' | 'tanggal' | 'rekeningId'>,
  ): Promise<string> {
    const id = row.id ?? generateId();
    await tx.insert(cashTransactions).values({ ...row, id });
    return id;
  }

  // ---------------------------------------------------------------- transaksi

  async catatMasuk(input: MasukInput, actorId: string): Promise<CashRow> {
    assertNominal(input.nominal);
    assertTanggal(input.tanggal);
    return this.run(async (tx) => {
      const existing = await this.findByKey(tx, input.idempotencyKey);
      if (existing) return existing;
      await this.requireKategori(tx, input.kategoriId, 'masuk');
      await this.requireRekeningAktif(tx, input.rekeningId);
      const tampilPublik = input.tampilPublik === true;
      if (tampilPublik && !input.donaturNama?.trim()) {
        bad('donatur_nama', 'Nama donatur wajib diisi jika ingin ditampilkan.');
      }
      const id = await this.insertCash(tx, {
        tipe: 'masuk',
        kategoriId: input.kategoriId,
        nominal: input.nominal,
        tanggal: input.tanggal,
        catatan: input.catatan ?? '',
        rekeningId: input.rekeningId,
        donaturNama: input.donaturNama?.trim() || null,
        tampilPublik,
        idempotencyKey: input.idempotencyKey,
        createdBy: actorId,
      });
      return this.findCash(tx, id);
    });
  }

  /**
   * Pengeluaran. Jika kas kurang, wajib ada talangan dengan total pokok = kekurangan.
   * Semua baris (talangan masuk, loan, pengeluaran) dibuat dalam satu transaksi DB.
   */
  async catatKeluar(input: KeluarInput, actorId: string): Promise<{ transaksi: CashRow; loans: LoanView[] }> {
    assertNominal(input.nominal);
    assertTanggal(input.tanggal);
    const talangan = input.talangan ?? [];
    for (const t of talangan) {
      assertNominal(t.pokok);
      if (!t.penalangNama?.trim()) bad('talangan', 'Setiap penalang wajib punya nama.');
    }
    return this.run(async (tx) => {
      const existing = await this.findByKey(tx, input.idempotencyKey);
      if (existing) {
        return { transaksi: existing, loans: await this.loansOfPengeluaran(tx, existing.id) };
      }
      const kategori = await this.requireKategori(tx, input.kategoriId, 'keluar');
      await this.requireRekeningAktif(tx, input.rekeningId);
      if (kategori.kode === KODE_KATEGORI_JASA && !input.penerimaNama?.trim()) {
        bad('penerima_nama', 'Nama penerima wajib diisi untuk jasa atau reward.');
      }

      const kas = await this.saldoRekening(tx, input.rekeningId);
      const kurang = Math.max(0, input.nominal - kas);
      const totalTalangan = talangan.reduce((acc, t) => acc + t.pokok, 0);
      if (kurang > 0 && talangan.length === 0) {
        throw new ConflictError('KAS_TIDAK_CUKUP', TRIGGER_ERRORS.KAS_TIDAK_CUKUP);
      }
      if (totalTalangan !== kurang) {
        throw new ConflictError(
          'TALANGAN_TIDAK_PAS',
          `Total talangan Rp ${totalTalangan.toLocaleString('id-ID')} harus sama dengan kekurangan kas Rp ${kurang.toLocaleString('id-ID')}.`,
        );
      }

      const pengeluaranId = generateId();
      if (talangan.length > 0) {
        // loan dibuat sebelum transaksi pengeluaran (FK loans -> pengeluaran).
        // Cek FK ditunda sampai commit, guard saldo tetap jalan di trigger.
        await tx.run(sql`PRAGMA defer_foreign_keys = ON`);
      }
      const loanIds: string[] = [];
      for (const t of talangan) {
        const loanId = generateId();
        loanIds.push(loanId);
        await tx.insert(loansTable).values({
          id: loanId,
          penalangUserId: t.penalangUserId ?? null,
          penalangNama: t.penalangNama.trim(),
          pokok: t.pokok,
          pengeluaranTxId: pengeluaranId,
          tanggalTalangan: input.tanggal,
          version: 0,
          createdBy: actorId,
        });
        await this.insertCash(tx, {
          tipe: 'masuk',
          kategoriSistem: 'talangan',
          nominal: t.pokok,
          tanggal: input.tanggal,
          rekeningId: input.rekeningId,
          loanId,
          createdBy: actorId,
        });
      }

      await this.insertCash(tx, {
        id: pengeluaranId,
        tipe: 'keluar',
        kategoriId: input.kategoriId,
        nominal: input.nominal,
        tanggal: input.tanggal,
        catatan: input.catatan ?? '',
        rekeningId: input.rekeningId,
        penerimaNama: input.penerimaNama?.trim() || null,
        penerimaUserId: input.penerimaUserId ?? null,
        buktiUrl: input.buktiUrl ?? null,
        pajakDipotong: input.pajakDipotong ?? null,
        idempotencyKey: input.idempotencyKey,
        createdBy: actorId,
      });

      const transaksi = await this.findCash(tx, pengeluaranId);
      const loans = await this.loansOfPengeluaran(tx, pengeluaranId);
      return { transaksi, loans };
    });
  }

  private async loansOfPengeluaran(tx: Tx, pengeluaranId: string): Promise<LoanView[]> {
    const all = await this.loanViews(tx);
    return all.filter((l) => l.pengeluaranTxId === pengeluaranId);
  }

  /** Reimburse talangan. Sisa dicek di sini dan dijaga ulang oleh trigger. */
  async catatReimburse(
    input: TransaksiBase & { loanId: string },
    actorId: string,
  ): Promise<CashRow> {
    assertNominal(input.nominal);
    assertTanggal(input.tanggal);
    return this.run(async (tx) => {
      const existing = await this.findByKey(tx, input.idempotencyKey);
      if (existing) return existing;
      const loan = await this.findLoan(tx, input.loanId);
      if (loan.status === 'dihibahkan' || loan.status === 'dibatalkan') {
        throw new ConflictError('LOAN_TIDAK_AKTIF', TRIGGER_ERRORS.LOAN_TIDAK_AKTIF);
      }
      if (input.nominal > loan.sisa) {
        throw new ConflictError(
          'REIMBURSE_MELEBIHI_SISA',
          `Sisa talangan Rp ${loan.sisa.toLocaleString('id-ID')}. Nominal reimburse tidak boleh lebih.`,
        );
      }
      await this.requireRekeningAktif(tx, input.rekeningId);
      const id = await this.insertCash(tx, {
        tipe: 'keluar',
        kategoriSistem: 'reimburse',
        nominal: input.nominal,
        tanggal: input.tanggal,
        catatan: input.catatan ?? '',
        rekeningId: input.rekeningId,
        loanId: input.loanId,
        idempotencyKey: input.idempotencyKey,
        createdBy: actorId,
      });
      await this.bumpLoanVersion(tx, loan);
      return this.findCash(tx, id);
    });
  }

  /** Optimistic lock: UPDATE hanya jika version masih sama. */
  private async bumpLoanVersion(tx: Tx, loan: LoanView): Promise<void> {
    const res = await tx.run(
      sql`UPDATE loans SET version = version + 1 WHERE id = ${loan.id} AND version = ${loan.version}`,
    );
    if (res.rowsAffected !== 1) {
      throw new ConflictError('KONFLIK_DATA', 'Data talangan baru saja berubah. Muat ulang lalu coba lagi.');
    }
  }

  /** Refund donasi. Total refund dibatasi nominal donasi asal oleh trigger. */
  async catatRefund(
    input: TransaksiBase & { refundDariId: string },
    actorId: string,
  ): Promise<CashRow> {
    assertNominal(input.nominal);
    assertTanggal(input.tanggal);
    return this.run(async (tx) => {
      const existing = await this.findByKey(tx, input.idempotencyKey);
      if (existing) return existing;
      const source = await this.findCash(tx, input.refundDariId);
      if (source.tipe !== 'masuk' || source.kategoriSistem !== null) {
        throw new ConflictError('REFUND_SUMBER_TIDAK_VALID', 'Refund hanya untuk uang masuk biasa, seperti donasi.');
      }
      if (await this.isReversed(tx, source.id)) {
        throw new ConflictError('TRANSAKSI_SUDAH_DIBATALKAN', 'Transaksi ini sudah dibatalkan.');
      }
      await this.requireRekeningAktif(tx, input.rekeningId);
      const id = await this.insertCash(tx, {
        tipe: 'keluar',
        kategoriSistem: 'refund',
        nominal: input.nominal,
        tanggal: input.tanggal,
        catatan: input.catatan ?? '',
        rekeningId: input.rekeningId,
        refundDariId: input.refundDariId,
        idempotencyKey: input.idempotencyKey,
        createdBy: actorId,
      });
      return this.findCash(tx, id);
    });
  }

  /** Transfer antar rekening: dua baris (keluar dan masuk) dengan pasangan yang sama. */
  async catatTransfer(
    input: TransaksiBase & { keRekeningId: string },
    actorId: string,
  ): Promise<CashRow[]> {
    assertNominal(input.nominal);
    assertTanggal(input.tanggal);
    if (input.keRekeningId === input.rekeningId) {
      bad('ke_rekening_id', 'Rekening asal dan tujuan tidak boleh sama.');
    }
    return this.run(async (tx) => {
      const existing = await this.findByKey(tx, input.idempotencyKey);
      if (existing) return [existing];
      await this.requireRekeningAktif(tx, input.rekeningId);
      await this.requireRekeningAktif(tx, input.keRekeningId);
      const pairId = generateId();
      const keluarId = await this.insertCash(tx, {
        tipe: 'keluar',
        kategoriSistem: 'transfer',
        nominal: input.nominal,
        tanggal: input.tanggal,
        catatan: input.catatan ?? '',
        rekeningId: input.rekeningId,
        transferPairId: pairId,
        idempotencyKey: input.idempotencyKey,
        createdBy: actorId,
      });
      const masukId = await this.insertCash(tx, {
        tipe: 'masuk',
        kategoriSistem: 'transfer',
        nominal: input.nominal,
        tanggal: input.tanggal,
        catatan: input.catatan ?? '',
        rekeningId: input.keRekeningId,
        transferPairId: pairId,
        createdBy: actorId,
      });
      return [await this.findCash(tx, keluarId), await this.findCash(tx, masukId)];
    });
  }

  /**
   * Koreksi lewat baris reversal. Riwayat asli tidak pernah diubah.
   * - Transfer: kedua kaki dibatalkan.
   * - Pengeluaran yang ditalangi: loan ikut dibatalkan, syarat belum ada reimburse dan belum dihibahkan.
   * - Talangan saja: ditolak, batalkan pengeluarannya.
   */
  async batalkan(
    targetId: string,
    input: { alasanKoreksi: string; idempotencyKey: string },
    actorId: string,
  ): Promise<CashRow> {
    if (!input.alasanKoreksi.trim()) bad('alasan_koreksi', 'Alasan koreksi wajib diisi.');
    return this.run(async (tx) => {
      const existing = await this.findByKey(tx, input.idempotencyKey);
      if (existing) return existing;
      const target = await this.findCash(tx, targetId);
      if (target.kategoriSistem === 'reversal') {
        throw new ConflictError('REVERSAL_TIDAK_BISA_DIBATALKAN', 'Koreksi tidak bisa dibatalkan lagi.');
      }
      if (await this.isReversed(tx, target.id)) {
        throw new ConflictError('TRANSAKSI_SUDAH_DIBATALKAN', 'Transaksi ini sudah dibatalkan.');
      }
      const tanggal = todayJakarta();
      const alasan = input.alasanKoreksi.trim();

      if (target.kategoriSistem === 'transfer' && target.transferPairId) {
        const legs = await tx
          .select()
          .from(cashTransactions)
          .where(eq(cashTransactions.transferPairId, target.transferPairId));
        let primary: CashRow | null = null;
        for (const leg of legs) {
          if (await this.isReversed(tx, leg.id)) continue;
          const row = await this.insertReversal(tx, leg, alasan, tanggal, actorId, primary ? null : input.idempotencyKey);
          primary ??= row;
        }
        if (!primary) throw new ConflictError('TRANSAKSI_SUDAH_DIBATALKAN', 'Transaksi ini sudah dibatalkan.');
        return primary;
      }

      if (target.kategoriSistem === 'talangan') {
        throw new ConflictError(
          'TALANGAN_TERKAIT_PENGELUARAN',
          'Talangan ini terkait pengeluaran. Batalkan pengeluarannya untuk membatalkan talangan.',
        );
      }

      const linked = (await this.loanViews(tx)).filter((l) => l.pengeluaranTxId === target.id);
      for (const loan of linked) {
        if (loan.reimbursed > 0) {
          throw new ConflictError(
            'TALANGAN_SUDAH_DIREIMBURSE',
            'Talangan dari pengeluaran ini sudah ada yang dikembalikan. Batalkan reimbursenya dulu.',
          );
        }
        if (loan.status === 'dihibahkan') {
          throw new ConflictError(
            'TALANGAN_SUDAH_DIHIBAHKAN',
            'Talangan dari pengeluaran ini sudah dihibahkan, jadi tidak bisa dibatalkan.',
          );
        }
      }

      // Pengeluaran dibalik dulu (kas naik), baru talangan (kas turun). Urutan ini menjaga guard saldo.
      const primary = await this.insertReversal(tx, target, alasan, tanggal, actorId, input.idempotencyKey);
      for (const loan of linked) {
        const talanganRows = await tx
          .select()
          .from(cashTransactions)
          .where(
            and(
              eq(cashTransactions.loanId, loan.id),
              eq(cashTransactions.kategoriSistem, 'talangan'),
              isNull(cashTransactions.dibatalkanDariId),
            ),
          );
        for (const row of talanganRows) {
          if (await this.isReversed(tx, row.id)) continue;
          await this.insertReversal(tx, row, alasan, tanggal, actorId, null);
        }
        await tx.run(
          sql`UPDATE loans SET dibatalkan_at = ${Math.floor(Date.now() / 1000)}, version = version + 1
              WHERE id = ${loan.id} AND version = ${loan.version}`,
        );
      }
      return primary;
    });
  }

  private async insertReversal(
    tx: Tx,
    row: CashRow,
    alasan: string,
    tanggal: string,
    actorId: string,
    idempotencyKey: string | null,
  ): Promise<CashRow> {
    const id = await this.insertCash(tx, {
      tipe: row.tipe === 'masuk' ? 'keluar' : 'masuk',
      kategoriSistem: 'reversal' as CashKategoriSistem,
      nominal: row.nominal,
      tanggal,
      catatan: `Koreksi transaksi ${row.id}`,
      rekeningId: row.rekeningId,
      loanId: row.loanId,
      kewajibanId: row.kewajibanId,
      periode: row.periode,
      dibatalkanDariId: row.id,
      alasanKoreksi: alasan,
      refundDariId: row.refundDariId,
      idempotencyKey,
      createdBy: actorId,
    });
    return this.findCash(tx, id);
  }

  /** Hibahkan sisa talangan: tidak ada uang keluar, loan tidak bisa direimburse lagi. */
  async hibahLoan(loanId: string, catatan: string): Promise<LoanView> {
    return this.run(async (tx) => {
      const loan = await this.findLoan(tx, loanId);
      if (loan.status !== 'outstanding') {
        throw new ConflictError('LOAN_TIDAK_AKTIF', 'Hanya talangan yang masih outstanding bisa dihibahkan.');
      }
      await tx.run(
        sql`UPDATE loans SET dihibahkan_at = ${Math.floor(Date.now() / 1000)}, catatan_hibah = ${catatan.trim() || null},
            version = version + 1 WHERE id = ${loanId} AND version = ${loan.version}`,
      );
      return this.findLoan(tx, loanId);
    });
  }

  // ---------------------------------------------------------------- kewajiban

  async listKewajiban(): Promise<KewajibanRow[]> {
    return this.db.select().from(kewajiban).orderBy(kewajiban.nama);
  }

  async createKewajiban(
    input: {
      nama: string;
      nominalEstimasi: number;
      kategoriId: string;
      recurrence: KewajibanRecurrence;
      periodeMulai: string;
      hariJatuhTempo: number;
    },
    actorId: string,
  ): Promise<KewajibanRow> {
    assertNominal(input.nominalEstimasi);
    if (!input.nama.trim()) bad('nama', 'Nama kewajiban wajib diisi.');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.periodeMulai)) bad('periode_mulai', 'Periode harus format YYYY-MM.');
    if (!Number.isInteger(input.hariJatuhTempo) || input.hariJatuhTempo < 1 || input.hariJatuhTempo > 31) {
      bad('hari_jatuh_tempo', 'Hari jatuh tempo harus 1 sampai 31.');
    }
    return this.run(async (tx) => {
      await this.requireKategori(tx, input.kategoriId, 'keluar');
      const id = generateId();
      await tx.insert(kewajiban).values({
        id,
        nama: input.nama.trim(),
        nominalEstimasi: input.nominalEstimasi,
        kategoriId: input.kategoriId,
        recurrence: input.recurrence,
        periodeMulai: input.periodeMulai,
        hariJatuhTempo: input.hariJatuhTempo,
        aktif: true,
        createdBy: actorId,
      });
      const [row] = await tx.select().from(kewajiban).where(eq(kewajiban.id, id));
      return row;
    });
  }

  /**
   * Berhenti: aktif = false dan berhenti_per = hari ini (atau tanggal yang dikirim).
   * Aktifkan lagi: jadwal dihitung dari bulan ini. Riwayat pembayaran tetap utuh.
   */
  async updateKewajiban(
    id: string,
    patch: { aktif?: boolean; berhentiPer?: string | null },
  ): Promise<KewajibanRow> {
    const today = todayJakarta();
    return this.run(async (tx) => {
      const [current] = await tx.select().from(kewajiban).where(eq(kewajiban.id, id)).limit(1);
      if (!current) throw new NotFoundError('KEWAJIBAN_TIDAK_DITEMUKAN', 'Kewajiban tidak ditemukan.');
      const set: Partial<typeof kewajiban.$inferInsert> = {};
      if (patch.aktif === false) {
        set.aktif = false;
        set.berhentiPer = patch.berhentiPer ?? today;
      } else if (patch.aktif === true) {
        set.aktif = true;
        set.berhentiPer = null;
        set.periodeMulai = periodeFromDate(today);
      } else if (patch.berhentiPer !== undefined) {
        set.berhentiPer = patch.berhentiPer;
      }
      if (set.berhentiPer && !isIsoDate(set.berhentiPer)) bad('berhenti_per', 'Tanggal harus format YYYY-MM-DD.');
      await tx.update(kewajiban).set(set).where(eq(kewajiban.id, id));
      const [row] = await tx.select().from(kewajiban).where(eq(kewajiban.id, id));
      return row;
    });
  }

  /** Bayar satu periode, boleh bertahap (cicilan). Status periode dihitung dari total. */
  async catatPembayaranKewajiban(
    kewajibanId: string,
    input: TransaksiBase & { periode: string },
    actorId: string,
  ): Promise<CashRow> {
    assertNominal(input.nominal);
    assertTanggal(input.tanggal);
    return this.run(async (tx) => {
      const existing = await this.findByKey(tx, input.idempotencyKey);
      if (existing) return existing;
      const [k] = await tx.select().from(kewajiban).where(eq(kewajiban.id, kewajibanId)).limit(1);
      if (!k) throw new NotFoundError('KEWAJIBAN_TIDAK_DITEMUKAN', 'Kewajiban tidak ditemukan.');
      const schedule = this.scheduleOf(k);
      if (!isPeriodeInSchedule(schedule, input.periode)) {
        throw new ConflictError('PERIODE_TIDAK_VALID', 'Periode ini tidak ada dalam jadwal kewajiban.');
      }
      await this.requireRekeningAktif(tx, input.rekeningId);
      const id = await this.insertCash(tx, {
        tipe: 'keluar',
        kategoriId: k.kategoriId,
        nominal: input.nominal,
        tanggal: input.tanggal,
        catatan: input.catatan ?? '',
        rekeningId: input.rekeningId,
        kewajibanId,
        periode: input.periode,
        idempotencyKey: input.idempotencyKey,
        createdBy: actorId,
      });
      return this.findCash(tx, id);
    });
  }

  private scheduleOf(k: KewajibanRow) {
    return {
      recurrence: k.recurrence,
      periodeMulai: k.periodeMulai,
      berhentiPer: k.berhentiPer,
    };
  }

  /**
   * Daftar pengingat: periode yang belum lunas, sampai satu bulan ke depan.
   * Dua query: kewajiban aktif dan total pembayaran per periode.
   */
  async listPengingat(today: string = todayJakarta()): Promise<PengingatItem[]> {
    const aktif = await this.db
      .select()
      .from(kewajiban)
      .where(eq(kewajiban.aktif, true));
    const paidRows = await this.db.all<{ kewajiban_id: string; periode: string; paid: number }>(sql`
      SELECT kewajiban_id, periode,
             SUM(CASE WHEN tipe = 'keluar' THEN nominal ELSE -nominal END) AS paid
      FROM cash_transactions
      WHERE kewajiban_id IS NOT NULL
      GROUP BY kewajiban_id, periode`);
    const paidMap = new Map<string, number>();
    for (const r of paidRows) paidMap.set(`${r.kewajiban_id}|${r.periode}`, Number(r.paid));

    const until = addMonthsToPeriode(periodeFromDate(today), 1);
    const items: PengingatItem[] = [];
    for (const k of aktif) {
      const periodes = generatePeriodes(this.scheduleOf(k), until);
      for (const periode of periodes) {
        const paid = paidMap.get(`${k.id}|${periode}`) ?? 0;
        const status = periodeStatus(paid, k.nominalEstimasi);
        if (status === 'lunas') continue;
        const due = dueDate(periode, k.hariJatuhTempo);
        items.push({
          kewajibanId: k.id,
          nama: k.nama,
          periode,
          dueDate: due,
          nominalEstimasi: k.nominalEstimasi,
          paid,
          sisa: Math.max(0, k.nominalEstimasi - paid),
          status,
          terlewat: isOverdue(due, today, status),
        });
      }
    }
    return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  // ---------------------------------------------------------------- rekonsiliasi

  /**
   * Cocokkan saldo ledger (sampai tanggal) dengan saldo bank. Selisih harus dijelaskan
   * dengan transaksi biaya admin atau bunga yang dicatat terpisah.
   */
  async rekonsiliasi(
    input: { rekeningId: string; tanggal: string; saldoBank: number; catatan?: string },
    actorId: string,
  ) {
    assertTanggal(input.tanggal);
    if (!Number.isSafeInteger(input.saldoBank)) bad('saldo_bank', 'Saldo bank harus bilangan bulat.');
    return this.run(async (tx) => {
      await this.requireRekeningAktif(tx, input.rekeningId);
      const saldoLedger = await this.saldoRekening(tx, input.rekeningId, input.tanggal);
      const id = generateId();
      await tx.insert(rekonsiliasi).values({
        id,
        rekeningId: input.rekeningId,
        tanggal: input.tanggal,
        saldoBank: input.saldoBank,
        saldoLedger,
        selisih: input.saldoBank - saldoLedger,
        catatan: input.catatan?.trim() ?? '',
        createdBy: actorId,
      });
      const [row] = await tx.select().from(rekonsiliasi).where(eq(rekonsiliasi.id, id));
      return row;
    });
  }

}
