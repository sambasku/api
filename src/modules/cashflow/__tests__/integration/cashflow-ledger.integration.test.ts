import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { CashflowService, type LoanView } from '@/modules/cashflow/application/cashflow.service';
import { ValidationError } from '@/shared/errors/app-error';

/**
 * Integration test ledger cashflow. Pakai file SQLite sendiri di folder temp
 * (bukan test.db bersama), dengan migrasi 0207 yang asli. Dua koneksi terpisah
 * dipakai untuk race condition yang sungguhan.
 */

const DB_FILE = join(tmpdir(), `cashflow-it-${process.pid}-${Date.now()}.db`);
const MIGRATION = resolve(process.cwd(), 'src/shared/database/drizzle/migrations/0207_cashflow_ledger.sql');
const ADMIN = 'USR-ADMIN';

function openConnection(): { client: Client; db: AppDatabase } {
  const client = createClient({ url: `file:${DB_FILE}` });
  return { client, db: drizzle(client, { schema }) };
}

const clients: Client[] = [];
let svcA: CashflowService;
let svcB: CashflowService;
let rawClient: Client;

async function expectConflict(p: Promise<unknown>, errorCode: string) {
  await expect(p).rejects.toMatchObject({ errorCode });
}

async function saldoOf(svc: CashflowService, rekeningId: string): Promise<number> {
  const s = await svc.getSummary();
  return s.rekening.find((r) => r.id === rekeningId)!.saldo;
}

async function loanOf(svc: CashflowService, loanId: string): Promise<LoanView> {
  const loans = await svc.listLoans();
  return loans.find((l) => l.id === loanId)!;
}

async function countWhere(where: string): Promise<number> {
  const res = await rawClient.execute(`SELECT COUNT(*) AS n FROM cash_transactions WHERE ${where}`);
  return Number(res.rows[0].n);
}

beforeAll(async () => {
  rawClient = createClient({ url: `file:${DB_FILE}` });
  clients.push(rawClient);
  await rawClient.execute('PRAGMA foreign_keys = ON');

  // Stub tabel users: hanya id, cukup untuk FK ledger.
  await rawClient.execute('CREATE TABLE users (id TEXT PRIMARY KEY NOT NULL)');
  await rawClient.execute(`INSERT INTO users (id) VALUES ('${ADMIN}')`);

  const migration = readFileSync(MIGRATION, 'utf8');
  for (const stmt of migration.split('--> statement-breakpoint')) {
    if (!stmt.trim()) continue;
    await rawClient.execute(stmt);
  }

  await rawClient.execute(`
    INSERT INTO rekening (id, nama, jenis, saldo_awal, aktif, created_at)
    VALUES ('REK-BANK', 'Bank utama', 'bank', 100000, 1, unixepoch()),
           ('REK-TUNAI', 'Kas tunai', 'tunai', 0, 1, unixepoch())`);

  // Tanpa busy_timeout: di file lokal (better-sqlite3, sinkron) menunggu lock
  // memblokir event loop, jadi transaksi pertama tidak bisa lanjut. Koneksi kedua
  // harus langsung gagal dengan SQLITE_BUSY, lalu dipetakan ke KONFLIK_DATA.
  const a = openConnection();
  const b = openConnection();
  clients.push(a.client, b.client);
  for (const c of [a.client, b.client]) {
    await c.execute('PRAGMA foreign_keys = ON');
  }
  svcA = new CashflowService(a.db);
  svcB = new CashflowService(b.db);
});

afterAll(() => {
  for (const c of clients) c.close();
  rmSync(DB_FILE, { force: true });
});

describe('ledger pengeluaran dan talangan', () => {
  it('pengeluaran dengan kas cukup tidak butuh talangan', async () => {
    const res = await svcA.catatKeluar(
      { kategoriId: 'KTR-KLR-SRV', rekeningId: 'REK-BANK', nominal: 30_000, tanggal: '2026-11-28', idempotencyKey: 'key-keluar-0001' },
      ADMIN,
    );
    expect(res.loans).toHaveLength(0);
    expect(await saldoOf(svcA, 'REK-BANK')).toBe(70_000);
  });

  it('kas kurang tanpa talangan ditolak', async () => {
    await expectConflict(
      svcA.catatKeluar(
        { kategoriId: 'KTR-KLR-SRV', rekeningId: 'REK-BANK', nominal: 200_000, tanggal: '2026-11-28', idempotencyKey: 'key-keluar-0002' },
        ADMIN,
      ),
      'KAS_TIDAK_CUKUP',
    );
    expect(await saldoOf(svcA, 'REK-BANK')).toBe(70_000);
  });

  it('talangan harus pas dengan kekurangan kas', async () => {
    await expectConflict(
      svcA.catatKeluar(
        {
          kategoriId: 'KTR-KLR-SRV',
          rekeningId: 'REK-BANK',
          nominal: 200_000,
          tanggal: '2026-11-28',
          talangan: [{ penalangNama: 'Budi', pokok: 100_000 }],
          idempotencyKey: 'key-keluar-0003',
        },
        ADMIN,
      ),
      'TALANGAN_TIDAK_PAS',
    );
  });

  it('dua penalang membiayai kekurangan, saldo bersih boleh minus', async () => {
    const res = await svcA.catatKeluar(
      {
        kategoriId: 'KTR-KLR-SRV',
        rekeningId: 'REK-BANK',
        nominal: 200_000,
        tanggal: '2026-11-28',
        talangan: [
          { penalangNama: 'Budi', pokok: 80_000 },
          { penalangNama: 'Sari', pokok: 50_000 },
        ],
        idempotencyKey: 'key-keluar-0004',
      },
      ADMIN,
    );
    expect(res.loans).toHaveLength(2);
    expect(await saldoOf(svcA, 'REK-BANK')).toBe(0);

    const summary = await svcA.getSummary();
    expect(summary.kasFisik).toBe(0);
    expect(summary.sisaTalangan).toBe(130_000);
    expect(summary.saldoBersih).toBe(-130_000);
  });

  it('idempotency: key yang sama tidak membuat baris ganda', async () => {
    const again = await svcA.catatKeluar(
      { kategoriId: 'KTR-KLR-SRV', rekeningId: 'REK-BANK', nominal: 30_000, tanggal: '2026-11-28', idempotencyKey: 'key-keluar-0001' },
      ADMIN,
    );
    expect(again.transaksi.nominal).toBe(30_000);
    expect(await countWhere("idempotency_key = 'key-keluar-0001'")).toBe(1);
  });

  it('jasa freelance wajib mengisi nama penerima', async () => {
    await expect(
      svcA.catatKeluar(
        { kategoriId: 'KTR-KLR-JSA', rekeningId: 'REK-BANK', nominal: 1_000, tanggal: '2026-11-28', idempotencyKey: 'key-jasa-0001' },
        ADMIN,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('race condition', () => {
  it('dua pengeluaran paralel: hanya satu lolos, saldo tidak minus', async () => {
    await svcA.catatMasuk(
      { kategoriId: 'KTR-MSK-DON', rekeningId: 'REK-BANK', nominal: 100_000, tanggal: '2026-11-28', idempotencyKey: 'key-donasi-0001' },
      ADMIN,
    );
    // Saldo sekarang 100.000. Dua pengeluaran 80.000 berebut kas yang sama.
    const results = await Promise.allSettled([
      svcA.catatKeluar(
        { kategoriId: 'KTR-KLR-SRV', rekeningId: 'REK-BANK', nominal: 80_000, tanggal: '2026-11-28', idempotencyKey: 'race-a-000001' },
        ADMIN,
      ),
      svcB.catatKeluar(
        { kategoriId: 'KTR-KLR-SRV', rekeningId: 'REK-BANK', nominal: 80_000, tanggal: '2026-11-28', idempotencyKey: 'race-b-000001' },
        ADMIN,
      ),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    // Loser kena kunci (KONFLIK_DATA) atau, bila sempat membaca saldo baru, KAS_TIDAK_CUKUP.
    expect(['KAS_TIDAK_CUKUP', 'KONFLIK_DATA']).toContain((failed[0].reason as { errorCode: string }).errorCode);
    expect(await saldoOf(svcA, 'REK-BANK')).toBe(20_000);
  });

  it('dua reimburse paralel ke talangan yang sama: sisa tidak pernah lewat', async () => {
    await svcA.catatMasuk(
      { kategoriId: 'KTR-MSK-DON', rekeningId: 'REK-BANK', nominal: 200_000, tanggal: '2026-11-28', idempotencyKey: 'key-donasi-0002' },
      ADMIN,
    );
    const loans = await svcA.listLoans();
    const budi = loans.find((l) => l.penalangNama === 'Budi')!;
    expect(budi.sisa).toBe(80_000);

    const results = await Promise.allSettled([
      svcA.catatReimburse({ loanId: budi.id, rekeningId: 'REK-BANK', nominal: 60_000, tanggal: '2026-11-28', idempotencyKey: 'race-reimb-a1' }, ADMIN),
      svcB.catatReimburse({ loanId: budi.id, rekeningId: 'REK-BANK', nominal: 60_000, tanggal: '2026-11-28', idempotencyKey: 'race-reimb-b1' }, ADMIN),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok).toHaveLength(1);
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(['REIMBURSE_MELEBIHI_SISA', 'KONFLIK_DATA']).toContain((failed.reason as { errorCode: string }).errorCode);
    expect((await loanOf(svcA, budi.id)).sisa).toBe(20_000);
  });

  it('riwayat tidak bisa di-UPDATE atau DELETE langsung', async () => {
    await expect(rawClient.execute('UPDATE cash_transactions SET nominal = 1')).rejects.toThrow(/APPEND_ONLY/);
    await expect(rawClient.execute('DELETE FROM cash_transactions')).rejects.toThrow(/APPEND_ONLY/);
  });

  it('CHECK database menolak nominal nol', async () => {
    await expect(
      rawClient.execute(
        `INSERT INTO cash_transactions (id, tipe, kategori_id, nominal, tanggal, rekening_id, idempotency_key, created_at)
         VALUES ('bad-zero', 'masuk', 'KTR-MSK-DON', 0, '2026-11-28', 'REK-BANK', NULL, unixepoch())`,
      ),
    ).rejects.toThrow(/CHECK/);
  });
});

describe('koreksi dan riwayat', () => {
  it('reversal reimburse mengembalikan sisa, dan koreksi ganda ditolak', async () => {
    const loans = await svcA.listLoans();
    const budi = loans.find((l) => l.penalangNama === 'Budi')!;
    const reimburseRow = (
      await rawClient.execute(
        `SELECT id FROM cash_transactions WHERE loan_id = '${budi.id}' AND kategori_sistem = 'reimburse'`,
      )
    ).rows[0];

    const reversal = await svcA.batalkan(
      String(reimburseRow.id),
      { alasanKoreksi: 'Nominal salah input', idempotencyKey: 'rev-reimb-0001' },
      ADMIN,
    );
    expect(reversal.tipe).toBe('masuk');
    expect(reversal.kategoriSistem).toBe('reversal');
    expect((await loanOf(svcA, budi.id)).sisa).toBe(80_000);

    await expectConflict(
      svcA.batalkan(String(reimburseRow.id), { alasanKoreksi: 'Lagi', idempotencyKey: 'rev-reimb-0002' }, ADMIN),
      'TRANSAKSI_SUDAH_DIBATALKAN',
    );
  });

  it('talangan tidak bisa dibatalkan sendiri, pengeluarannya membatalkan loan', async () => {
    const talanganRow = (
      await rawClient.execute(`SELECT id FROM cash_transactions WHERE kategori_sistem = 'talangan' LIMIT 1`)
    ).rows[0];
    await expectConflict(
      svcA.batalkan(
        String(talanganRow.id),
        { alasanKoreksi: 'Coba batal talangan saja', idempotencyKey: 'rev-talangan-0001' },
        ADMIN,
      ),
      'TALANGAN_TERKAIT_PENGELUARAN',
    );

    const pengeluaranRow = (
      await rawClient.execute(
        `SELECT id FROM cash_transactions WHERE idempotency_key = 'key-keluar-0004'`,
      )
    ).rows[0];
    const before = await saldoOf(svcA, 'REK-BANK');
    await svcA.batalkan(
      String(pengeluaranRow.id),
      { alasanKoreksi: 'Pengeluaran dibatalkan vendor', idempotencyKey: 'rev-keluar-0004' },
      ADMIN,
    );
    expect(await saldoOf(svcA, 'REK-BANK')).toBe(before + 200_000 - 130_000);

    const loans = await svcA.listLoans();
    const dibatalkan = loans.filter((l) => l.status === 'dibatalkan');
    expect(dibatalkan).toHaveLength(2);
    const summary = await svcA.getSummary();
    expect(summary.sisaTalangan).toBe(0);
  });

  it('refund total dibatasi nominal donasi asal', async () => {
    const donasi = (
      await rawClient.execute(`SELECT id FROM cash_transactions WHERE idempotency_key = 'key-donasi-0002'`)
    ).rows[0];
    const refund = await svcA.catatRefund(
      { refundDariId: String(donasi.id), rekeningId: 'REK-BANK', nominal: 150_000, tanggal: '2026-11-28', idempotencyKey: 'refund-0001' },
      ADMIN,
    );
    expect(refund.kategoriSistem).toBe('refund');
    await expectConflict(
      svcA.catatRefund(
        { refundDariId: String(donasi.id), rekeningId: 'REK-BANK', nominal: 100_000, tanggal: '2026-11-28', idempotencyKey: 'refund-0002' },
        ADMIN,
      ),
      'REFUND_MELEBIHI_DONASI',
    );
  });

  it('loan yang dihibahkan tidak bisa direimburse', async () => {
    await svcA.catatKeluar(
      {
        kategoriId: 'KTR-KLR-OPS',
        rekeningId: 'REK-TUNAI',
        nominal: 50_000,
        tanggal: '2026-11-28',
        talangan: [{ penalangNama: 'Ani', pokok: 50_000 }],
        idempotencyKey: 'key-hibah-0001',
      },
      ADMIN,
    );
    const ani = (await svcA.listLoans()).find((l) => l.penalangNama === 'Ani')!;
    await svcA.hibahLoan(ani.id, 'Dihibahkan untuk komunitas');
    await expectConflict(
      svcA.catatReimburse({ loanId: ani.id, rekeningId: 'REK-BANK', nominal: 10_000, tanggal: '2026-11-28', idempotencyKey: 'reimb-hibah-1' }, ADMIN),
      'LOAN_TIDAK_AKTIF',
    );
  });
});

describe('kewajiban, transfer, dan rekonsiliasi', () => {
  it('cicilan satu periode: sebagian lalu lunas, dan koreksi memundurkan status', async () => {
    await svcA.catatMasuk(
      { kategoriId: 'KTR-MSK-DON', rekeningId: 'REK-BANK', nominal: 500_000, tanggal: '2026-12-01', idempotencyKey: 'key-donasi-0003' },
      ADMIN,
    );
    const kw = await svcA.createKewajiban(
      {
        nama: 'Listrik',
        nominalEstimasi: 300_000,
        kategoriId: 'KTR-KLR-SRV',
        recurrence: 'bulanan',
        periodeMulai: '2026-12',
        hariJatuhTempo: 5,
      },
      ADMIN,
    );

    const pengingatAwal = await svcA.listPengingat('2026-12-10');
    const desAwal = pengingatAwal.find((p) => p.kewajibanId === kw.id && p.periode === '2026-12')!;
    expect(desAwal.status).toBe('belum');
    expect(desAwal.terlewat).toBe(true);

    await svcA.catatPembayaranKewajiban(
      kw.id,
      { periode: '2026-12', rekeningId: 'REK-BANK', nominal: 200_000, tanggal: '2026-12-03', idempotencyKey: 'bayar-listrik-1' },
      ADMIN,
    );
    const sebagian = (await svcA.listPengingat('2026-12-10')).find((p) => p.kewajibanId === kw.id && p.periode === '2026-12')!;
    expect(sebagian.status).toBe('sebagian');
    expect(sebagian.sisa).toBe(100_000);

    const bayar2 = await svcA.catatPembayaranKewajiban(
      kw.id,
      { periode: '2026-12', rekeningId: 'REK-BANK', nominal: 100_000, tanggal: '2026-12-25', idempotencyKey: 'bayar-listrik-2' },
      ADMIN,
    );
    const pengingatLunas = await svcA.listPengingat('2026-12-26');
    expect(pengingatLunas.find((p) => p.kewajibanId === kw.id && p.periode === '2026-12')).toBeUndefined();
    expect(pengingatLunas.find((p) => p.kewajibanId === kw.id && p.periode === '2027-01')?.status).toBe('belum');

    await svcA.batalkan(bayar2.id, { alasanKoreksi: 'Transfer salah rekening', idempotencyKey: 'rev-bayar-2' }, ADMIN);
    const kembali = (await svcA.listPengingat('2026-12-26')).find(
      (p) => p.kewajibanId === kw.id && p.periode === '2026-12',
    )!;
    expect(kembali.status).toBe('sebagian');
  });

  it('pembayaran periode di luar jadwal ditolak', async () => {
    const kw = (await svcA.listKewajiban()).find((k) => k.nama === 'Listrik')!;
    await expectConflict(
      svcA.catatPembayaranKewajiban(
        kw.id,
        { periode: '2026-06', rekeningId: 'REK-BANK', nominal: 1_000, tanggal: '2026-12-03', idempotencyKey: 'bayar-invalid-1' },
        ADMIN,
      ),
      'PERIODE_TIDAK_VALID',
    );
  });

  it('transfer antar rekening membuat dua kaki yang berpasangan', async () => {
    const [keluar, masuk] = await svcA.catatTransfer(
      { rekeningId: 'REK-BANK', keRekeningId: 'REK-TUNAI', nominal: 10_000, tanggal: '2026-11-28', idempotencyKey: 'transfer-0001' },
      ADMIN,
    );
    expect(keluar.transferPairId).toBe(masuk.transferPairId);
    expect(keluar.tipe).toBe('keluar');
    expect(masuk.tipe).toBe('masuk');
    expect(await saldoOf(svcA, 'REK-TUNAI')).toBe(10_000);
  });

  it('rekonsiliasi mencatat selisih terhadap saldo bank', async () => {
    const rek = await svcA.rekonsiliasi(
      { rekeningId: 'REK-TUNAI', tanggal: '2026-11-30', saldoBank: 12_000, catatan: 'Ada bunga Rp 2.000' },
      ADMIN,
    );
    expect(rek.saldoLedger).toBe(10_000);
    expect(rek.selisih).toBe(2_000);
  });
});
