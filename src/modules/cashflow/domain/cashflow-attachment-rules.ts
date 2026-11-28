import { AppError } from '@/shared/errors/app-error';
import type { CashAttachmentMime } from '@/shared/database/drizzle/schema/cash-attachment.schema';

/** Maksimal lampiran aktif (belum dihapus) per transaksi. */
export const MAX_LAMPIRAN_PER_TRANSAKSI = 10;

/** Masa berlaku URL presigned untuk membuka lampiran (detik). */
export const LAMPIRAN_URL_TTL_SECONDS = 300;

/** Batas multipart overhead di atas ukuran file (boundary + header). */
export const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;

export class LampiranTerlaluBesarError extends AppError {
  statusCode = 413;
  errorCode = 'LAMPIRAN_TERLALU_BESAR';
  constructor(batasMb: number) {
    super(`File terlalu besar. Batas ${batasMb} MB per file.`);
  }
}

const EXT: Record<CashAttachmentMime, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function startsWith(bytes: Uint8Array, sig: number[]): boolean {
  if (bytes.length < sig.length) return false;
  return sig.every((b, i) => bytes[i] === b);
}

/**
 * Deteksi jenis dari isi file (magic bytes), bukan dari mime yang dikirim client.
 * Null = jenis tidak didukung.
 */
export function detectAttachmentMime(bytes: Uint8Array): CashAttachmentMime | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf'; // %PDF-
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

/**
 * Object key acak di bucket privat. Nama asli file TIDAK masuk key (hanya di DB).
 * Format: cashflow/{yyyy}/{mm}/{txId}/{id}.{ext}
 */
export function buildObjectKey(
  txId: string,
  tanggal: string,
  id: string,
  mime: CashAttachmentMime,
): string {
  const [yyyy, mm] = tanggal.split('-');
  return `cashflow/${yyyy}/${mm}/${txId}/${id}.${EXT[mime]}`;
}

export async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
