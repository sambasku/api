import type { Context, MiddlewareHandler } from 'hono';
import { z } from 'zod';
import { requireMinRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { UnauthorizedError, ValidationError } from '@/shared/errors/app-error';
import type { AppVariables } from '@/shared/types';
import { KATEGORI_TRANSAKSI_TIPE } from '@/shared/database/drizzle/schema/kategori-transaksi.schema';
import { REKENING_JENIS } from '@/shared/database/drizzle/schema/rekening.schema';
import { KEWAJIBAN_RECURRENCE } from '@/shared/database/drizzle/schema/kewajiban.schema';
import { CASH_DONATUR_TIPE } from '@/shared/database/drizzle/schema/cash-ledger.schema';
import type { CashflowService, LoanView, PengingatItem, Summary } from '../../application/cashflow.service';
import type { AttachmentRow, CashflowAttachmentService } from '../../application/cashflow-attachment.service';
import {
  LampiranTerlaluBesarError,
  MULTIPART_OVERHEAD_BYTES,
} from '../../domain/cashflow-attachment-rules';

// ---------------------------------------------------------------- validasi

const idSchema = z.string().min(1).max(64);
const nominalSchema = z.number().int().positive().max(1_000_000_000_000);
const tanggalSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal harus format YYYY-MM-DD.');
/** Batas baris riwayat transaksi per request (satu query, tanpa N+1). */
const MAX_LIMIT_TRANSAKSI = 500;
const rentangTanggalSchema = z
  .object({ from: tanggalSchema.optional(), to: tanggalSchema.optional() })
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: 'Tanggal mulai tidak boleh setelah tanggal akhir.',
    path: ['from'],
  });
const periodeSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Periode harus format YYYY-MM.');
const idempotencySchema = z.string().min(8).max(64);
const catatanSchema = z.string().max(500).optional();

const kategoriCreateSchema = z.object({
  kode: z.string().min(2).max(20),
  nama: z.string().min(1).max(80),
  tipe: z.enum(KATEGORI_TRANSAKSI_TIPE),
});
const kategoriPatchSchema = z.object({
  nama: z.string().min(1).max(80).optional(),
  aktif: z.boolean().optional(),
});
const rekeningCreateSchema = z.object({
  nama: z.string().min(1).max(80),
  jenis: z.enum(REKENING_JENIS),
  saldo_awal: z.number().int().default(0),
});
const rekeningPatchSchema = kategoriPatchSchema;

const masukSchema = z.object({
  kategori_id: idSchema,
  rekening_id: idSchema,
  nominal: nominalSchema,
  tanggal: tanggalSchema,
  catatan: catatanSchema,
  donatur_tipe: z.enum(CASH_DONATUR_TIPE).nullable().optional(),
  donatur_user_id: idSchema.nullable().optional(),
  donatur_usaha_id: idSchema.nullable().optional(),
  donatur_nama: z.string().max(80).nullable().optional(),
  tampil_publik: z.boolean().optional(),
  idempotency_key: idempotencySchema,
});

const talanganSchema = z.object({
  penalang_user_id: idSchema.nullable().optional(),
  penalang_nama: z.string().min(1).max(80),
  pokok: nominalSchema,
});

const keluarSchema = z.object({
  kategori_id: idSchema,
  rekening_id: idSchema,
  nominal: nominalSchema,
  tanggal: tanggalSchema,
  catatan: catatanSchema,
  penerima_nama: z.string().max(80).nullable().optional(),
  penerima_user_id: idSchema.nullable().optional(),
  bukti_url: z.string().url().max(500).nullable().optional(),
  pajak_dipotong: z.number().int().nonnegative().nullable().optional(),
  talangan: z.array(talanganSchema).max(10).optional(),
  idempotency_key: idempotencySchema,
});

const reimburseSchema = z.object({
  loan_id: idSchema,
  rekening_id: idSchema,
  nominal: nominalSchema,
  tanggal: tanggalSchema,
  catatan: catatanSchema,
  idempotency_key: idempotencySchema,
});

const refundSchema = z.object({
  refund_dari_id: idSchema,
  rekening_id: idSchema,
  nominal: nominalSchema,
  tanggal: tanggalSchema,
  catatan: catatanSchema,
  idempotency_key: idempotencySchema,
});

const transferSchema = z.object({
  dari_rekening_id: idSchema,
  ke_rekening_id: idSchema,
  nominal: nominalSchema,
  tanggal: tanggalSchema,
  catatan: catatanSchema,
  idempotency_key: idempotencySchema,
});

const reversalSchema = z.object({
  alasan_koreksi: z.string().min(3).max(300),
  idempotency_key: idempotencySchema,
});

const hibahSchema = z.object({ catatan: z.string().max(300).optional() });

const kewajibanCreateSchema = z.object({
  nama: z.string().min(1).max(120),
  nominal_estimasi: nominalSchema,
  kategori_id: idSchema,
  recurrence: z.enum(KEWAJIBAN_RECURRENCE),
  periode_mulai: periodeSchema,
  hari_jatuh_tempo: z.number().int().min(1).max(31),
});
const kewajibanPatchSchema = z.object({
  aktif: z.boolean().optional(),
  berhenti_per: tanggalSchema.nullable().optional(),
});
const pembayaranSchema = z.object({
  periode: periodeSchema,
  rekening_id: idSchema,
  nominal: nominalSchema,
  tanggal: tanggalSchema,
  catatan: catatanSchema,
  idempotency_key: idempotencySchema,
});

const rekonsiliasiSchema = z.object({
  rekening_id: idSchema,
  tanggal: tanggalSchema,
  saldo_bank: z.number().int(),
  catatan: z.string().max(300).optional(),
});

function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      result.error.issues.map((i) => ({ field: i.path.join('.') || 'body', message: i.message })),
    );
  }
  return result.data;
}

async function readBody(c: Context): Promise<unknown> {
  return c.req.json().catch(() => ({}));
}

function actorOf(c: Context<{ Variables: AppVariables }>): string {
  const user = c.get('user');
  if (!user) throw new UnauthorizedError('Kamu harus login untuk mengakses fitur ini.');
  return user.user_id;
}

// ---------------------------------------------------------------- wire

function iso(v: Date | null | undefined): string | null {
  return v ? v.toISOString() : null;
}

function wireCash(r: {
  id: string;
  tipe: string;
  kategoriId: string | null;
  kategoriSistem: string | null;
  nominal: number;
  tanggal: string;
  catatan: string;
  rekeningId: string;
  loanId: string | null;
  kewajibanId: string | null;
  periode: string | null;
  dibatalkanDariId: string | null;
  alasanKoreksi: string | null;
  refundDariId: string | null;
  transferPairId: string | null;
  penerimaNama: string | null;
  penerimaUserId: string | null;
  buktiUrl: string | null;
  pajakDipotong: number | null;
  donaturNama: string | null;
  donaturTipe: string | null;
  donaturUserId: string | null;
  donaturUsahaId: string | null;
  tampilPublik: boolean;
  createdAt: Date;
}) {
  return {
    id: r.id,
    tipe: r.tipe,
    kategori_id: r.kategoriId,
    kategori_sistem: r.kategoriSistem,
    nominal: r.nominal,
    tanggal: r.tanggal,
    catatan: r.catatan,
    rekening_id: r.rekeningId,
    loan_id: r.loanId,
    kewajiban_id: r.kewajibanId,
    periode: r.periode,
    dibatalkan_dari_id: r.dibatalkanDariId,
    alasan_koreksi: r.alasanKoreksi,
    refund_dari_id: r.refundDariId,
    transfer_pair_id: r.transferPairId,
    penerima_nama: r.penerimaNama,
    penerima_user_id: r.penerimaUserId,
    bukti_url: r.buktiUrl,
    pajak_dipotong: r.pajakDipotong,
    donatur_nama: r.donaturNama,
    donatur_tipe: r.donaturTipe,
    donatur_user_id: r.donaturUserId,
    donatur_usaha_id: r.donaturUsahaId,
    tampil_publik: r.tampilPublik,
    created_at: r.createdAt.toISOString(),
  };
}

function wireLoan(l: LoanView) {
  return {
    id: l.id,
    penalang_user_id: l.penalangUserId,
    penalang_nama: l.penalangNama,
    pokok: l.pokok,
    reimbursed: l.reimbursed,
    sisa: l.sisa,
    tanggal_talangan: l.tanggalTalangan,
    pengeluaran_tx_id: l.pengeluaranTxId,
    status: l.status,
    version: l.version,
  };
}

function wireSummary(s: Summary) {
  return {
    rekening: s.rekening.map((r) => ({ id: r.id, nama: r.nama, jenis: r.jenis, saldo: r.saldo })),
    kas_fisik: s.kasFisik,
    sisa_talangan: s.sisaTalangan,
    saldo_bersih: s.saldoBersih,
  };
}

function wirePengingat(p: PengingatItem) {
  return {
    kewajiban_id: p.kewajibanId,
    nama: p.nama,
    periode: p.periode,
    due_date: p.dueDate,
    nominal_estimasi: p.nominalEstimasi,
    paid: p.paid,
    sisa: p.sisa,
    status: p.status,
    terlewat: p.terlewat,
  };
}

// ---------------------------------------------------------------- routes

export interface AdminCashflowRoutesDeps {
  service: CashflowService;
  attachments: CashflowAttachmentService;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

function wireLampiran(r: AttachmentRow) {
  return {
    id: r.id,
    transaction_id: r.transactionId,
    original_name: r.originalName,
    mime: r.mime,
    size_bytes: r.sizeBytes,
    sha256: r.sha256,
    uploaded_by: r.uploadedBy,
    created_at: iso(r.createdAt),
  };
}

/** Keuangan (cashflow). Mount di /api/v1/admin/cashflow. Strict level admin ke atas (admin dan root). */
export function createAdminCashflowRoutes(deps: AdminCashflowRoutesDeps) {
  const { service, attachments } = deps;
  const routes = createOpenApiApp();
  routes.use('*', deps.authenticate, requireMinRole('admin'), rateLimit({ points: 60, duration: 60 }));

  // ringkasan dan baca
  routes.get('/summary', async (c) => c.json({ success: true as const, data: wireSummary(await service.getSummary()) }));
  routes.get('/transactions', async (c) => {
    const limit = Math.min(Number(c.req.query('limit') ?? 50) || 50, MAX_LIMIT_TRANSAKSI);
    const { from, to } = parse(rentangTanggalSchema, { from: c.req.query('from'), to: c.req.query('to') });
    const rows = await service.listTransaksi({ limit, from, to });
    const jumlah = await attachments.hitungPerTransaksi(rows.map((r) => r.id));
    return c.json({
      success: true as const,
      data: rows.map((r) => ({ ...wireCash(r), lampiran_count: jumlah.get(r.id) ?? 0 })),
    });
  });
  routes.get('/loans', async (c) => {
    const rows = await service.listLoans();
    return c.json({ success: true as const, data: rows.map(wireLoan) });
  });
  routes.get('/pengingat', async (c) => {
    const rows = await service.listPengingat();
    return c.json({ success: true as const, data: rows.map(wirePengingat) });
  });

  // pencarian untuk picker donatur, sponsor, dan penalang (maks 10 hasil, kata kunci minimal 2 huruf)
  routes.get('/lookup/users', async (c) => {
    const rows = await service.cariUser(c.req.query('q') ?? '');
    return c.json({ success: true as const, data: rows });
  });
  routes.get('/lookup/usaha', async (c) => {
    const rows = await service.cariUsaha(c.req.query('q') ?? '');
    return c.json({ success: true as const, data: rows });
  });

  // master
  routes.get('/categories', async (c) => {
    const rows = await service.listKategori();
    return c.json({
      success: true as const,
      data: rows.map((r) => ({ id: r.id, kode: r.kode, nama: r.nama, tipe: r.tipe, aktif: r.aktif })),
    });
  });
  routes.post('/categories', async (c) => {
    const body = parse(kategoriCreateSchema, await readBody(c));
    const r = await service.createKategori({ kode: body.kode, nama: body.nama, tipe: body.tipe });
    return c.json({ success: true as const, data: { id: r.id, kode: r.kode, nama: r.nama, tipe: r.tipe, aktif: r.aktif } }, 201);
  });
  routes.patch('/categories/:id', async (c) => {
    const body = parse(kategoriPatchSchema, await readBody(c));
    const r = await service.updateKategori(c.req.param('id'), body);
    return c.json({ success: true as const, data: { id: r.id, kode: r.kode, nama: r.nama, tipe: r.tipe, aktif: r.aktif } });
  });
  routes.get('/rekening', async (c) => {
    const rows = await service.listRekening();
    return c.json({
      success: true as const,
      data: rows.map((r) => ({ id: r.id, nama: r.nama, jenis: r.jenis, saldo_awal: r.saldoAwal, aktif: r.aktif })),
    });
  });
  routes.post('/rekening', async (c) => {
    const body = parse(rekeningCreateSchema, await readBody(c));
    const r = await service.createRekening({ nama: body.nama, jenis: body.jenis, saldoAwal: body.saldo_awal });
    return c.json({ success: true as const, data: { id: r.id, nama: r.nama, jenis: r.jenis, saldo_awal: r.saldoAwal, aktif: r.aktif } }, 201);
  });
  routes.patch('/rekening/:id', async (c) => {
    const body = parse(rekeningPatchSchema, await readBody(c));
    const r = await service.updateRekening(c.req.param('id'), body);
    return c.json({ success: true as const, data: { id: r.id, nama: r.nama, jenis: r.jenis, saldo_awal: r.saldoAwal, aktif: r.aktif } });
  });

  // transaksi
  routes.post('/transactions/masuk', async (c) => {
    const body = parse(masukSchema, await readBody(c));
    const row = await service.catatMasuk(
      {
        kategoriId: body.kategori_id,
        rekeningId: body.rekening_id,
        nominal: body.nominal,
        tanggal: body.tanggal,
        catatan: body.catatan,
        donaturTipe: body.donatur_tipe ?? null,
        donaturUserId: body.donatur_user_id ?? null,
        donaturUsahaId: body.donatur_usaha_id ?? null,
        donaturNama: body.donatur_nama ?? null,
        tampilPublik: body.tampil_publik,
        idempotencyKey: body.idempotency_key,
      },
      actorOf(c),
    );
    return c.json({ success: true as const, data: wireCash(row) }, 201);
  });
  routes.post('/transactions/keluar', async (c) => {
    const body = parse(keluarSchema, await readBody(c));
    const result = await service.catatKeluar(
      {
        kategoriId: body.kategori_id,
        rekeningId: body.rekening_id,
        nominal: body.nominal,
        tanggal: body.tanggal,
        catatan: body.catatan,
        penerimaNama: body.penerima_nama ?? null,
        penerimaUserId: body.penerima_user_id ?? null,
        buktiUrl: body.bukti_url ?? null,
        pajakDipotong: body.pajak_dipotong ?? null,
        talangan: (body.talangan ?? []).map((t) => ({
          penalangUserId: t.penalang_user_id ?? null,
          penalangNama: t.penalang_nama,
          pokok: t.pokok,
        })),
        idempotencyKey: body.idempotency_key,
      },
      actorOf(c),
    );
    return c.json(
      { success: true as const, data: { transaksi: wireCash(result.transaksi), loans: result.loans.map(wireLoan) } },
      201,
    );
  });
  routes.post('/transactions/reimburse', async (c) => {
    const body = parse(reimburseSchema, await readBody(c));
    const row = await service.catatReimburse(
      {
        loanId: body.loan_id,
        rekeningId: body.rekening_id,
        nominal: body.nominal,
        tanggal: body.tanggal,
        catatan: body.catatan,
        idempotencyKey: body.idempotency_key,
      },
      actorOf(c),
    );
    return c.json({ success: true as const, data: wireCash(row) }, 201);
  });
  routes.post('/transactions/refund', async (c) => {
    const body = parse(refundSchema, await readBody(c));
    const row = await service.catatRefund(
      {
        refundDariId: body.refund_dari_id,
        rekeningId: body.rekening_id,
        nominal: body.nominal,
        tanggal: body.tanggal,
        catatan: body.catatan,
        idempotencyKey: body.idempotency_key,
      },
      actorOf(c),
    );
    return c.json({ success: true as const, data: wireCash(row) }, 201);
  });
  routes.post('/transactions/transfer', async (c) => {
    const body = parse(transferSchema, await readBody(c));
    const rows = await service.catatTransfer(
      {
        rekeningId: body.dari_rekening_id,
        keRekeningId: body.ke_rekening_id,
        nominal: body.nominal,
        tanggal: body.tanggal,
        catatan: body.catatan,
        idempotencyKey: body.idempotency_key,
      },
      actorOf(c),
    );
    return c.json({ success: true as const, data: rows.map(wireCash) }, 201);
  });
  routes.post('/transactions/:id/reversal', async (c) => {
    const body = parse(reversalSchema, await readBody(c));
    const row = await service.batalkan(
      c.req.param('id'),
      { alasanKoreksi: body.alasan_koreksi, idempotencyKey: body.idempotency_key },
      actorOf(c),
    );
    return c.json({ success: true as const, data: wireCash(row) }, 201);
  });

  // loan
  routes.post('/loans/:id/hibah', async (c) => {
    const body = parse(hibahSchema, await readBody(c));
    const loan = await service.hibahLoan(c.req.param('id'), body.catatan ?? '');
    return c.json({ success: true as const, data: wireLoan(loan) });
  });

  // kewajiban
  routes.get('/kewajiban', async (c) => {
    const rows = await service.listKewajiban();
    return c.json({
      success: true as const,
      data: rows.map((k) => ({
        id: k.id,
        nama: k.nama,
        nominal_estimasi: k.nominalEstimasi,
        kategori_id: k.kategoriId,
        recurrence: k.recurrence,
        periode_mulai: k.periodeMulai,
        hari_jatuh_tempo: k.hariJatuhTempo,
        aktif: k.aktif,
        berhenti_per: k.berhentiPer,
      })),
    });
  });
  routes.post('/kewajiban', async (c) => {
    const body = parse(kewajibanCreateSchema, await readBody(c));
    const k = await service.createKewajiban(
      {
        nama: body.nama,
        nominalEstimasi: body.nominal_estimasi,
        kategoriId: body.kategori_id,
        recurrence: body.recurrence,
        periodeMulai: body.periode_mulai,
        hariJatuhTempo: body.hari_jatuh_tempo,
      },
      actorOf(c),
    );
    return c.json({ success: true as const, data: { id: k.id, nama: k.nama, aktif: k.aktif } }, 201);
  });
  routes.patch('/kewajiban/:id', async (c) => {
    const body = parse(kewajibanPatchSchema, await readBody(c));
    const k = await service.updateKewajiban(c.req.param('id'), {
      aktif: body.aktif,
      berhentiPer: body.berhenti_per,
    });
    return c.json({ success: true as const, data: { id: k.id, aktif: k.aktif, berhenti_per: k.berhentiPer } });
  });
  routes.post('/kewajiban/:id/pembayaran', async (c) => {
    const body = parse(pembayaranSchema, await readBody(c));
    const row = await service.catatPembayaranKewajiban(
      c.req.param('id'),
      {
        periode: body.periode,
        rekeningId: body.rekening_id,
        nominal: body.nominal,
        tanggal: body.tanggal,
        catatan: body.catatan,
        idempotencyKey: body.idempotency_key,
      },
      actorOf(c),
    );
    return c.json({ success: true as const, data: wireCash(row) }, 201);
  });

  // rekonsiliasi
  routes.post('/rekonsiliasi', async (c) => {
    const body = parse(rekonsiliasiSchema, await readBody(c));
    const r = await service.rekonsiliasi(
      {
        rekeningId: body.rekening_id,
        tanggal: body.tanggal,
        saldoBank: body.saldo_bank,
        catatan: body.catatan,
      },
      actorOf(c),
    );
    return c.json(
      {
        success: true as const,
        data: {
          id: r.id,
          rekening_id: r.rekeningId,
          tanggal: r.tanggal,
          saldo_bank: r.saldoBank,
          saldo_ledger: r.saldoLedger,
          selisih: r.selisih,
          catatan: r.catatan,
          created_at: iso(r.createdAt),
        },
      },
      201,
    );
  });

  // lampiran bukti (R2 privat). Batas ukuran dicek dari Content-Length sebelum multipart dibaca.
  routes.get('/transactions/:id/attachments', async (c) => {
    const rows = await attachments.daftar(c.req.param('id'));
    return c.json({ success: true as const, data: rows.map(wireLampiran) });
  });
  routes.post('/transactions/:id/attachments', async (c) => {
    const panjang = Number(c.req.header('content-length') ?? 0);
    if (panjang > attachments.batasBytes + MULTIPART_OVERHEAD_BYTES) {
      throw new LampiranTerlaluBesarError(Math.floor(attachments.batasBytes / (1024 * 1024)));
    }
    const body = await c.req.parseBody();
    const file = body['file'];
    if (!(file instanceof File)) {
      throw new ValidationError([{ field: 'file', message: 'Pilih file lampirannya dulu ya.' }]);
    }
    const row = await attachments.tambah(
      c.req.param('id'),
      {
        bytes: new Uint8Array(await file.arrayBuffer()),
        name: file.name,
        claimedMime: file.type,
      },
      actorOf(c),
    );
    return c.json({ success: true as const, data: wireLampiran(row) }, 201);
  });
  routes.get('/attachments/:id/url', async (c) => {
    const r = await attachments.urlUntuk(c.req.param('id'));
    return c.json({ success: true as const, data: { url: r.url, expires_in: r.expiresIn } });
  });
  routes.delete('/attachments/:id', async (c) => {
    const row = await attachments.hapus(c.req.param('id'), actorOf(c));
    return c.json({ success: true as const, data: wireLampiran(row) });
  });

  return routes;
}
