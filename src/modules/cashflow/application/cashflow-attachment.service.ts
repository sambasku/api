import { and, asc, count, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { AppDatabase, AppTransaction } from '@/shared/database/drizzle/client';
import { cashAttachments, type CashAttachmentMime } from '@/shared/database/drizzle/schema/cash-attachment.schema';
import { cashTransactions } from '@/shared/database/drizzle/schema/cash-ledger.schema';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
  ValidationError,
} from '@/shared/errors/app-error';
import { generateId } from '@/shared/utils/ulid';
import type { CashflowFileStorage } from '../infrastructure/cashflow-file-storage';
import {
  LAMPIRAN_URL_TTL_SECONDS,
  LampiranTerlaluBesarError,
  MAX_LAMPIRAN_PER_TRANSAKSI,
  buildObjectKey,
  detectAttachmentMime,
  sha256Hex,
} from '../domain/cashflow-attachment-rules';

export interface AttachmentRow {
  id: string;
  transactionId: string;
  originalName: string;
  mime: CashAttachmentMime;
  sizeBytes: number;
  sha256: string;
  uploadedBy: string | null;
  createdAt: Date;
}

function batasLampiranTerlampaui(): ConflictError {
  return new ConflictError(
    'LAMPIRAN_MELEBIHI_BATAS',
    `Maksimal ${MAX_LAMPIRAN_PER_TRANSAKSI} lampiran per transaksi. Hapus yang tidak perlu dulu.`,
  );
}

export interface UploadedFile {
  bytes: Uint8Array<ArrayBuffer>;
  name: string;
  /** Mime yang dikirim client. Hanya dicatat, keputusan jenis memakai magic bytes. */
  claimedMime: string;
}

/**
 * Lampiran bukti transaksi cashflow. Objek di R2 privat, metadata di `cash_attachments`.
 * Upload: validasi, dedupe sha256, objek dulu lalu insert dalam transaksi DB.
 * Gagal insert = objek dihapus best-effort (tidak ada objek yatim).
 */
export class CashflowAttachmentService {
  constructor(
    private readonly db: AppDatabase,
    private readonly storage: CashflowFileStorage | null,
    readonly batasBytes: number,
  ) {}

  private requireStorage(): CashflowFileStorage {
    if (!this.storage) {
      throw new ServiceUnavailableError(
        'CASHFLOW_FILE_UNAVAILABLE',
        'Penyimpanan lampiran belum dikonfigurasi.',
      );
    }
    return this.storage;
  }

  private async assertTransaksi(txId: string): Promise<{ id: string; tanggal: string }> {
    const [row] = await this.db
      .select({ id: cashTransactions.id, tanggal: cashTransactions.tanggal })
      .from(cashTransactions)
      .where(eq(cashTransactions.id, txId))
      .limit(1);
    if (!row) throw new NotFoundError('TRANSAKSI_TIDAK_DITEMUKAN', 'Transaksi tidak ditemukan.');
    return row;
  }

  private async findLiveBySha(txId: string, sha: string): Promise<AttachmentRow | null> {
    const [row] = await this.db
      .select()
      .from(cashAttachments)
      .where(
        and(
          eq(cashAttachments.transactionId, txId),
          eq(cashAttachments.sha256, sha),
          isNull(cashAttachments.deletedAt),
        ),
      )
      .limit(1);
    return row ? toRow(row) : null;
  }

  async tambah(txId: string, file: UploadedFile, actorId: string): Promise<AttachmentRow> {
    const storage = this.requireStorage();
    if (file.bytes.byteLength === 0) {
      throw new ValidationError([{ field: 'file', message: 'File kosong. Pilih file lain ya.' }]);
    }
    if (file.bytes.byteLength > this.batasBytes) {
      throw new LampiranTerlaluBesarError(Math.floor(this.batasBytes / (1024 * 1024)));
    }
    const mime = detectAttachmentMime(file.bytes);
    if (!mime) {
      throw new BadRequestError(
        'LAMPIRAN_JENIS_TIDAK_DIDUKUNG',
        'Jenis file harus PDF, JPG, PNG, atau WebP.',
      );
    }
    const tx = await this.assertTransaksi(txId);
    const sha = await sha256Hex(file.bytes);

    // File identik sudah ada di transaksi ini: kembalikan yang lama, tidak upload ulang.
    const existing = await this.findLiveBySha(txId, sha);
    if (existing) return existing;

    // Cek awal sebelum upload. Cek ulang di dalam transaksi DB tetap dilakukan (race).
    if ((await this.hitungAktif(this.db, txId)) >= MAX_LAMPIRAN_PER_TRANSAKSI) {
      throw batasLampiranTerlampaui();
    }

    const id = generateId();
    const key = buildObjectKey(txId, tx.tanggal, id, mime);
    await storage.put(key, file.bytes, mime);

    try {
      await this.db.transaction(async (db) => {
        if ((await this.hitungAktif(db, txId)) >= MAX_LAMPIRAN_PER_TRANSAKSI) {
          throw batasLampiranTerlampaui();
        }
        await db.insert(cashAttachments).values({
          id,
          transactionId: txId,
          objectKey: key,
          originalName: file.name.slice(0, 200) || 'lampiran',
          mime,
          sizeBytes: file.bytes.byteLength,
          sha256: sha,
          uploadedBy: actorId,
        });
      });
    } catch (err) {
      await storage.remove(key).catch(() => undefined);
      // Race: request lain menempel file identik dulu (unique sha256). Pakai yang sudah ada.
      const raced = await this.findLiveBySha(txId, sha);
      if (raced) return raced;
      throw err;
    }

    const [row] = await this.db.select().from(cashAttachments).where(eq(cashAttachments.id, id)).limit(1);
    return toRow(row!);
  }

  private async hitungAktif(db: AppDatabase | AppTransaction, txId: string): Promise<number> {
    const [{ total }] = await db
      .select({ total: count() })
      .from(cashAttachments)
      .where(and(eq(cashAttachments.transactionId, txId), isNull(cashAttachments.deletedAt)));
    return Number(total);
  }

  async daftar(txId: string): Promise<AttachmentRow[]> {
    await this.assertTransaksi(txId);
    const rows = await this.db
      .select()
      .from(cashAttachments)
      .where(and(eq(cashAttachments.transactionId, txId), isNull(cashAttachments.deletedAt)))
      .orderBy(asc(cashAttachments.createdAt), asc(cashAttachments.id));
    return rows.map(toRow);
  }

  /** Jumlah lampiran aktif per transaksi dalam satu query (dipakai daftar transaksi). */
  async hitungPerTransaksi(txIds: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (txIds.length === 0) return result;
    const rows = await this.db
      .select({
        transactionId: cashAttachments.transactionId,
        total: sql<number>`count(*)`,
      })
      .from(cashAttachments)
      .where(and(inArray(cashAttachments.transactionId, txIds), isNull(cashAttachments.deletedAt)))
      .groupBy(cashAttachments.transactionId);
    for (const r of rows) result.set(r.transactionId, Number(r.total));
    return result;
  }

  /** URL presigned GET untuk membuka lampiran. Dihitung lokal, tanpa panggilan jaringan ke R2. */
  async urlUntuk(id: string): Promise<{ url: string; expiresIn: number }> {
    const storage = this.requireStorage();
    const row = await this.findLive(id);
    const url = await storage.presignGet(row.objectKey, LAMPIRAN_URL_TTL_SECONDS);
    return { url, expiresIn: LAMPIRAN_URL_TTL_SECONDS };
  }

  /** Soft delete. Objek di R2 tetap ada (tidak pernah dihapus aplikasi). */
  async hapus(id: string, actorId: string): Promise<AttachmentRow> {
    const row = await this.findLive(id);
    await this.db
      .update(cashAttachments)
      .set({ deletedAt: new Date(), deletedBy: actorId })
      .where(and(eq(cashAttachments.id, id), isNull(cashAttachments.deletedAt)));
    return toRow(row);
  }

  private async findLive(id: string) {
    const [row] = await this.db
      .select()
      .from(cashAttachments)
      .where(and(eq(cashAttachments.id, id), isNull(cashAttachments.deletedAt)))
      .limit(1);
    if (!row) throw new NotFoundError('LAMPIRAN_TIDAK_DITEMUKAN', 'Lampiran tidak ditemukan.');
    return row;
  }
}

function toRow(r: typeof cashAttachments.$inferSelect): AttachmentRow {
  return {
    id: r.id,
    transactionId: r.transactionId,
    originalName: r.originalName,
    mime: r.mime,
    sizeBytes: r.sizeBytes,
    sha256: r.sha256,
    uploadedBy: r.uploadedBy,
    createdAt: r.createdAt,
  };
}
