import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { CashflowService, type LoanView } from '@/modules/cashflow/application/cashflow.service';
import { CashflowAttachmentService } from '@/modules/cashflow/application/cashflow-attachment.service';
import type { CashflowFileStorage } from '@/modules/cashflow/infrastructure/cashflow-file-storage';
import { ValidationError } from '@/shared/errors/app-error';

/**
 * Integration test ledger cashflow. Pakai file SQLite sendiri di folder temp
 * (bukan test.db bersama), dengan migrasi 0207 yang asli. Dua koneksi terpisah
 * dipakai untuk race condition yang sungguhan.
 */

const DB_FILE = join(tmpdir(), `cashflow-it-${process.pid}-${Date.now()}.db`);
const MIGRATIONS = ['0207_cashflow_ledger.sql', '0209_cashflow_donatur_ref.sql', '0211_cashflow_attachments.sql'].map((f) =>
  resolve(process.cwd(), 'src/shared/database/drizzle/migrations', f),
);
const ADMIN = 'USR-ADMIN';

function openConnection(): { client: Client; db: AppDatabase } {
  const client = createClient({ url: `file:${DB_FILE}` });
  return { client, db: drizzle(client, { schema }) };
}

const clients: Client[] = [];

/** Penyimpanan palsu: menyimpan objek di memori dan menghitung put/remove. */
class FakeStorage implements CashflowFileStorage {
  objects = new Map<string, Uint8Array>();
  puts = 0;
  removes = 0;
  async put(key: string, body: Uint8Array): Promise<void> {
    this.puts++;
    this.objects.set(key, body);
  }
  async remove(key: string): Promise<void> {
    this.removes++;
    this.objects.delete(key);
  }
  async presignGet(key: string, expiresInSeconds: number): Promise<string> {
    return `https://r2.test/${key}?X-Amz-Expires=${expiresInSeconds}`;
  }
}

/** File dengan header PDF dan tag unik, supaya sha256-nya berbeda per tag. */
function pdf(tag: string, size = 64): Uint8Array<ArrayBuffer> {
  const head = new TextEncoder().encode(`%PDF-1.4 ${tag} `);
  const out = new Uint8Array(new ArrayBuffer(Math.max(size, head.length)));
  out.set(head);
  return out;
}
let svcA: CashflowService;
let svcB: CashflowService;
let attA: CashflowAttachmentService;
let storageA: FakeStorage;
let dbA: AppDatabase;
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

  // Stub users dan usahas: hanya kolom yang dipakai ledger (FK, nama donatur, pencarian).
  await rawClient.execute(
    `CREATE TABLE users (id TEXT PRIMARY KEY NOT NULL, username TEXT NOT NULL, display_name TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1, deleted_at INTEGER)`,
  );
  await rawClient.execute(
    `INSERT INTO users (id, username, display_name, is_active) VALUES
       ('${ADMIN}', 'admin', 'Admin', 1),
       ('USR-DONOR', 'siti', 'Siti Aminah', 1),
       ('USR-OFF', 'sitioff', 'Siti Nonaktif', 0)`,
  );
  await rawClient.execute(
    'CREATE TABLE usahas (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, slug TEXT NOT NULL, deleted_at INTEGER)',
  );
  await rawClient.execute(
    `INSERT INTO usahas (id, name, slug, deleted_at) VALUES
       ('USH-1', 'Toko Maju Jaya', 'toko-maju-jaya', NULL),
       ('USH-DEL', 'Toko Dihapus', 'toko-dihapus', 1)`,
  );

  for (const file of MIGRATIONS) {
    const migration = readFileSync(file, 'utf8');
    for (const stmt of migration.split('--> statement-breakpoint')) {
      if (!stmt.trim()) continue;
      await rawClient.execute(stmt);
    }
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
  storageA = new FakeStorage();
  dbA = a.db;
  attA = new CashflowAttachmentService(a.db, storageA, 1024 * 1024);
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

  it('transfer ditolak jika saldo rekening asal kurang', async () => {
    await expectConflict(
      svcA.catatTransfer(
        { rekeningId: 'REK-TUNAI', keRekeningId: 'REK-BANK', nominal: 999_999_999, tanggal: '2026-11-28', idempotencyKey: 'transfer-kurang-1' },
        ADMIN,
      ),
      'KAS_TIDAK_CUKUP',
    );
    expect(await saldoOf(svcA, 'REK-TUNAI')).toBe(10_000);
  });

  it('transfer ke rekening yang sama ditolak', async () => {
    await expect(
      svcA.catatTransfer(
        { rekeningId: 'REK-BANK', keRekeningId: 'REK-BANK', nominal: 1_000, tanggal: '2026-11-28', idempotencyKey: 'transfer-sama-1' },
        ADMIN,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
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

describe('donatur, sponsor, dan penalang terhubung ke akun atau usaha', () => {
  const base = { kategoriId: 'KTR-MSK-SPN', rekeningId: 'REK-BANK', nominal: 10_000, tanggal: '2026-12-02' };

  it('sponsor usaha: nama diambil dari data usaha, bukan dari input client', async () => {
    const row = await svcA.catatMasuk(
      { ...base, donaturTipe: 'usaha', donaturUsahaId: 'USH-1', donaturNama: 'nama palsu', idempotencyKey: 'sponsor-usaha-01' },
      ADMIN,
    );
    expect(row.donaturTipe).toBe('usaha');
    expect(row.donaturUsahaId).toBe('USH-1');
    expect(row.donaturUserId).toBeNull();
    expect(row.donaturNama).toBe('Toko Maju Jaya');
  });

  it('sponsor usaha tanpa memilih usaha ditolak', async () => {
    await expect(
      svcA.catatMasuk({ ...base, donaturTipe: 'usaha', idempotencyKey: 'sponsor-usaha-02' }, ADMIN),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('usaha yang sudah dihapus tidak bisa jadi sponsor', async () => {
    await expect(
      svcA.catatMasuk({ ...base, donaturTipe: 'usaha', donaturUsahaId: 'USH-DEL', idempotencyKey: 'sponsor-usaha-03' }, ADMIN),
    ).rejects.toMatchObject({ errorCode: 'USAHA_TIDAK_DITEMUKAN' });
  });

  it('donatur perorangan akun: nama diambil dari akun', async () => {
    const row = await svcA.catatMasuk(
      { ...base, donaturTipe: 'perorangan', donaturUserId: 'USR-DONOR', donaturNama: 'nama palsu', idempotencyKey: 'donatur-akun-01' },
      ADMIN,
    );
    expect(row.donaturTipe).toBe('perorangan');
    expect(row.donaturUserId).toBe('USR-DONOR');
    expect(row.donaturNama).toBe('Siti Aminah');
  });

  it('akun nonaktif tidak bisa dipilih sebagai donatur', async () => {
    await expect(
      svcA.catatMasuk({ ...base, donaturTipe: 'perorangan', donaturUserId: 'USR-OFF', idempotencyKey: 'donatur-akun-02' }, ADMIN),
    ).rejects.toMatchObject({ errorCode: 'USER_TIDAK_DITEMUKAN' });
  });

  it('donatur perorangan tanpa akun: nama bebas tersimpan', async () => {
    const row = await svcA.catatMasuk(
      { ...base, donaturTipe: 'perorangan', donaturNama: 'Hamba Allah', idempotencyKey: 'donatur-bebas-01' },
      ADMIN,
    );
    expect(row.donaturTipe).toBe('perorangan');
    expect(row.donaturUserId).toBeNull();
    expect(row.donaturNama).toBe('Hamba Allah');
  });

  it('perorangan tanpa akun dan tanpa nama ditolak', async () => {
    await expect(
      svcA.catatMasuk({ ...base, donaturTipe: 'perorangan', idempotencyKey: 'donatur-bebas-02' }, ADMIN),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('donatur anonim tetap boleh, tapi tidak boleh membawa referensi tanpa jenis', async () => {
    const anonim = await svcA.catatMasuk({ ...base, idempotencyKey: 'donatur-anonim-01' }, ADMIN);
    expect(anonim.donaturTipe).toBeNull();
    expect(anonim.donaturNama).toBeNull();
    await expect(
      svcA.catatMasuk({ ...base, donaturUserId: 'USR-DONOR', idempotencyKey: 'donatur-anonim-02' }, ADMIN),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('trigger database menolak referensi donatur yang tidak konsisten', async () => {
    await expect(
      rawClient.execute(
        `INSERT INTO cash_transactions (id, tipe, kategori_id, nominal, tanggal, rekening_id, donatur_tipe, created_at)
         VALUES ('bad-donatur', 'masuk', 'KTR-MSK-SPN', 1000, '2026-12-02', 'REK-BANK', 'usaha', unixepoch())`,
      ),
    ).rejects.toThrow(/DONATUR_TIDAK_VALID/);
  });

  it('penalang akun: nama diambil dari akun dan tersimpan sebagai referensi', async () => {
    await rawClient.execute(
      `INSERT INTO rekening (id, nama, jenis, saldo_awal, aktif, created_at) VALUES ('REK-TES', 'Kas tes', 'tunai', 0, 1, unixepoch())`,
    );
    const res = await svcA.catatKeluar(
      {
        kategoriId: 'KTR-KLR-OPS',
        rekeningId: 'REK-TES',
        nominal: 25_000,
        tanggal: '2026-12-02',
        talangan: [{ penalangUserId: 'USR-DONOR', penalangNama: 'nama palsu', pokok: 25_000 }],
        idempotencyKey: 'penalang-akun-01',
      },
      ADMIN,
    );
    expect(res.loans[0].penalangUserId).toBe('USR-DONOR');
    expect(res.loans[0].penalangNama).toBe('Siti Aminah');
  });

  it('pencarian akun: cocok nama, abaikan akun nonaktif dan kata kunci pendek', async () => {
    const hasil = await svcA.cariUser('siti');
    expect(hasil.map((h) => h.id)).toEqual(['USR-DONOR']);
    expect(hasil[0]).toMatchObject({ nama: 'Siti Aminah', detail: '@siti' });
    expect(await svcA.cariUser('s')).toEqual([]);
    expect(await svcA.cariUser('%%')).toEqual([]);
  });

  it('pencarian usaha: abaikan usaha yang sudah dihapus', async () => {
    const hasil = await svcA.cariUsaha('toko');
    expect(hasil.map((h) => h.id)).toEqual(['USH-1']);
  });
});

describe('lampiran bukti transaksi', () => {
  let txId: string;
  let txBatas: string;

  beforeAll(async () => {
    txId = (
      await svcA.catatMasuk(
        { kategoriId: 'KTR-MSK-DON', rekeningId: 'REK-BANK', nominal: 1_000, tanggal: '2026-11-28', idempotencyKey: 'att-tx-0001' },
        ADMIN,
      )
    ).id;
    txBatas = (
      await svcA.catatMasuk(
        { kategoriId: 'KTR-MSK-DON', rekeningId: 'REK-BANK', nominal: 1_000, tanggal: '2026-11-28', idempotencyKey: 'att-tx-0002' },
        ADMIN,
      )
    ).id;
  });

  it('upload PDF tersimpan dengan object key privat dan bisa dibuka lewat URL presigned', async () => {
    const row = await attA.tambah(txId, { bytes: pdf('nota-1'), name: 'nota.pdf', claimedMime: 'application/pdf' }, ADMIN);
    expect(row.mime).toBe('application/pdf');
    expect(row.originalName).toBe('nota.pdf');

    const [key] = [...storageA.objects.keys()];
    expect(key.startsWith(`cashflow/2026/11/${txId}/`)).toBe(true);
    expect(key.endsWith('.pdf')).toBe(true);
    expect(key).not.toContain('nota');

    const daftar = await attA.daftar(txId);
    expect(daftar.map((r) => r.id)).toContain(row.id);

    const signed = await attA.urlUntuk(row.id);
    expect(signed.expiresIn).toBe(300);
    expect(signed.url).toContain('X-Amz-Expires=300');
  });

  it('file identik di transaksi yang sama tidak diupload ulang', async () => {
    const pertama = (await attA.daftar(txId))[0];
    const puts = storageA.puts;
    const lagi = await attA.tambah(txId, { bytes: pdf('nota-1'), name: 'salinan.pdf', claimedMime: 'application/pdf' }, ADMIN);
    expect(lagi.id).toBe(pertama.id);
    expect(storageA.puts).toBe(puts);
  });

  it('jenis yang tidak didukung ditolak walau mime-nya mengaku PDF', async () => {
    await expectConflict(
      attA.tambah(txId, { bytes: new TextEncoder().encode('halo dunia'), name: 'a.pdf', claimedMime: 'application/pdf' }, ADMIN),
      'LAMPIRAN_JENIS_TIDAK_DIDUKUNG',
    );
  });

  it('JPG, PNG, dan WebP diterima dari isi file', async () => {
    const jpg = new Uint8Array(new ArrayBuffer(32));
    jpg.set([0xff, 0xd8, 0xff, 0xe0]);
    const png = new Uint8Array(new ArrayBuffer(32));
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const webp = new TextEncoder().encode('RIFF\u0000\u0000\u0000\u0000WEBPVP8 ');
    const hasil = [];
    for (const [i, bytes] of [jpg, png, webp].entries()) {
      hasil.push((await attA.tambah(txId, { bytes, name: `foto-${i}`, claimedMime: 'image/*' }, ADMIN)).mime);
    }
    expect(hasil).toEqual(['image/jpeg', 'image/png', 'image/webp']);
  });

  it('ukuran di atas batas ditolak dengan kode LAMPIRAN_TERLALU_BESAR', async () => {
    await expectConflict(
      attA.tambah(txBatas, { bytes: pdf('besar', 1024 * 1024 + 1), name: 'besar.pdf', claimedMime: 'application/pdf' }, ADMIN),
      'LAMPIRAN_TERLALU_BESAR',
    );
  });

  it('batas 10 lampiran aktif per transaksi, dan hapus membuka slot lagi', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      ids.push((await attA.tambah(txBatas, { bytes: pdf(`batas-${i}`), name: `b${i}.pdf`, claimedMime: 'application/pdf' }, ADMIN)).id);
    }
    await expectConflict(
      attA.tambah(txBatas, { bytes: pdf('batas-11'), name: 'b11.pdf', claimedMime: 'application/pdf' }, ADMIN),
      'LAMPIRAN_MELEBIHI_BATAS',
    );
    expect((await attA.hitungPerTransaksi([txBatas])).get(txBatas)).toBe(10);

    await attA.hapus(ids[0], ADMIN);
    const sebelum = storageA.objects.size;
    const baru = await attA.tambah(txBatas, { bytes: pdf('batas-11'), name: 'b11.pdf', claimedMime: 'application/pdf' }, ADMIN);
    expect(baru.id).toBeTruthy();
    expect((await attA.hitungPerTransaksi([txBatas])).get(txBatas)).toBe(10);
    expect(storageA.objects.size).toBe(sebelum + 1);
  });

  it('hapus hanya soft delete: objek di R2 tetap ada dan lampiran tidak tampil lagi', async () => {
    const [target] = await attA.daftar(txBatas);
    const objekSebelum = storageA.objects.size;
    const removesSebelum = storageA.removes;
    await attA.hapus(target.id, ADMIN);

    expect(storageA.objects.size).toBe(objekSebelum);
    expect(storageA.removes).toBe(removesSebelum);
    expect((await attA.daftar(txBatas)).map((r) => r.id)).not.toContain(target.id);
    await expect(attA.urlUntuk(target.id)).rejects.toMatchObject({ errorCode: 'LAMPIRAN_TIDAK_DITEMUKAN' });
  });

  it('tanpa konfigurasi R2 membalas 503 CASHFLOW_FILE_UNAVAILABLE', async () => {
    const tanpa = new CashflowAttachmentService(dbA, null, 1024);
    await expectConflict(
      tanpa.tambah(txId, { bytes: pdf('tanpa-r2'), name: 'x.pdf', claimedMime: 'application/pdf' }, ADMIN),
      'CASHFLOW_FILE_UNAVAILABLE',
    );
  });

  it('transaksi yang tidak ada ditolak', async () => {
    await expectConflict(attA.daftar('TX-TIDAK-ADA'), 'TRANSAKSI_TIDAK_DITEMUKAN');
  });
});
