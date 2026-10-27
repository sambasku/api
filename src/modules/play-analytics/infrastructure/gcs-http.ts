import { AnalyticsProviderError } from '../application/ports/play-analytics.port';

  /** Timeout satu request ke Google, selaras web-analytics. */
const TIMEOUT_MS = 10_000;

/**
 * Agregasi CSV butuh GET (list bucket + unduh object), bukan POST seperti
 * GA4/GSC. Normalisasi error tetap sama: semua gagal jadi
 * AnalyticsProviderError.
 */
function kindForStatus(status: number): 'permission_denied' | 'rate_limited' | 'upstream' {
  if (status === 401 || status === 403) return 'permission_denied';
  if (status === 429) return 'rate_limited';
  return 'upstream';
}

/** Ambil body mentah dari Google (untuk file biner/gzip, mis. export CSV Play). */
async function getGoogleBytes(
  account: { clientEmail: string; privateKey: string },
  scope: string,
  url: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const { getGoogleAccessToken, GoogleTokenError } = await import('@/shared/google/service-account-token');
  let token: string;
  try {
    token = await getGoogleAccessToken(account, scope);
  } catch (err) {
    if (err instanceof GoogleTokenError) {
      const kind = err.status === 0 ? 'network' : err.status >= 500 ? 'upstream' : 'permission_denied';
      throw new AnalyticsProviderError(kind, err.message);
    }
    throw new AnalyticsProviderError('permission_denied', `Private key service account tidak valid: ${(err as Error).message}`);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new AnalyticsProviderError('network', (err as Error).message);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new AnalyticsProviderError(kindForStatus(res.status), `status=${res.status} ${text.slice(0, 300)}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function getGoogleText(
  account: { clientEmail: string; privateKey: string },
  scope: string,
  url: string,
): Promise<string> {
  return new TextDecoder().decode(await getGoogleBytes(account, scope, url));
}

export interface GcsListResult {
  /** Nama object lengkap, mis: stats/installs/installs_pkg_202610_overview.csv */
  objects: string[];
  /** pageToken utk halaman berikutnya, null kalau habis. */
  nextPageToken: string | null;
}

/** List object dalam bucket via JSON API (GET b/{bucket}/o). */
export async function listGcsObjects(
  account: { clientEmail: string; privateKey: string },
  bucket: string,
  prefix: string,
  opts: { pageToken?: string } = {},
): Promise<GcsListResult> {
  const params = new URLSearchParams({ prefix, maxResults: '100' });
  if (opts.pageToken) params.set('pageToken', opts.pageToken);
  const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o?${params}`;
  const json = JSON.parse(await getGoogleText(account, GCS_SCOPE, url)) as {
    items?: Array<{ name?: string }>;
    nextPageToken?: string;
  };
  return {
    objects: (json.items ?? []).map((i) => i.name ?? '').filter(Boolean),
    nextPageToken: json.nextPageToken ?? null,
  };
}

export const GCS_SCOPE = 'https://www.googleapis.com/auth/devstorage.read_only';

/**
 * Unduh isi object CSV Play. Export Play Console selalu gzip + UTF-16LE
 * (contentType `text/csv; charset=utf-16le`, contentEncoding gzip), dan GCS
 * JSON API `alt=media` tidak selalu mem-forward Content-Encoding - jadi
 * dekompres + decode dikerjakan manual.
 */
/** Deteksi + dekompres gzip dan decode UTF-16/UTF-8 export Play. */
export async function decodePlayCsvBytes(input: Uint8Array<ArrayBuffer>): Promise<string> {
  let bytes: Uint8Array<ArrayBuffer> = input;
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  // BOM UTF-16LE (ff fe) / UTF-16BE (fe ff) -> decode sesuai; sisanya UTF-8.
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  return new TextDecoder('utf-8').decode(bytes);
}

export async function downloadGcsObject(
  account: { clientEmail: string; privateKey: string },
  bucket: string,
  objectName: string,
): Promise<string> {
  const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}?alt=media`;
  return decodePlayCsvBytes(await getGoogleBytes(account, GCS_SCOPE, url));
}
