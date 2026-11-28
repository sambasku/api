import { AwsClient } from 'aws4fetch';
import { env } from '@/shared/config/env';
import { BadGatewayError } from '@/shared/errors/app-error';

/** Penyimpanan objek lampiran. Bucket privat: tidak ada akses publik, hanya URL presigned. */
export interface CashflowFileStorage {
  put(key: string, body: Uint8Array, mime: string): Promise<void>;
  /** Best-effort: dipanggil saat insert DB gagal supaya tidak ada objek yatim. */
  remove(key: string): Promise<void>;
  presignGet(key: string, expiresInSeconds: number): Promise<string>;
}

/** Cloudflare R2 lewat S3 API (path-style). Jalan di Node (Docker) dan Workers. */
export class R2CashflowFileStorage implements CashflowFileStorage {
  private readonly client: AwsClient;
  private readonly base: string;

  constructor(endpoint: string, private readonly bucket: string, accessKeyId: string, secretAccessKey: string) {
    this.base = endpoint.replace(/\/$/, '');
    this.client = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
  }

  private url(key: string): string {
    return `${this.base}/${this.bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  async put(key: string, body: Uint8Array, mime: string): Promise<void> {
    const res = await this.client.fetch(this.url(key), {
      method: 'PUT',
      body,
      headers: { 'content-type': mime },
    });
    if (!res.ok) {
      throw new BadGatewayError('LAMPIRAN_UPLOAD_GAGAL', 'Penyimpanan lampiran menolak file. Coba lagi ya.');
    }
  }

  async remove(key: string): Promise<void> {
    await this.client.fetch(this.url(key), { method: 'DELETE' });
  }

  async presignGet(key: string, expiresInSeconds: number): Promise<string> {
    const u = new URL(this.url(key));
    u.searchParams.set('X-Amz-Expires', String(expiresInSeconds));
    const signed = await this.client.sign(u.toString(), { method: 'GET', aws: { signQuery: true } });
    return signed.url;
  }
}

/**
 * Pilih storage dari env. Null = belum dikonfigurasi (service membalas 503 CASHFLOW_FILE_UNAVAILABLE).
 * Provider tak dikenal = crash saat boot (fail fast), pola sama dengan createImageStorage.
 */
export function createCashflowFileStorage(): CashflowFileStorage | null {
  const provider = (env.CASHFLOW_FILE_PROVIDER ?? '').trim().toLowerCase();
  if (provider === '') return null;
  if (provider !== 'r2') {
    throw new Error(`CASHFLOW_FILE_PROVIDER "${env.CASHFLOW_FILE_PROVIDER}" tidak dikenal - tersedia: r2`);
  }
  if (!env.R2_S3_ENDPOINT || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.CASHFLOW_R2_BUCKET) {
    return null;
  }
  return new R2CashflowFileStorage(
    env.R2_S3_ENDPOINT,
    env.CASHFLOW_R2_BUCKET,
    env.R2_ACCESS_KEY_ID,
    env.R2_SECRET_ACCESS_KEY,
  );
}
