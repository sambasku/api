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

export async function getGoogleText(
  account: { clientEmail: string; privateKey: string },
  scope: string,
  url: string,
): Promise<string> {
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
  return res.text();
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

/** Unduh isi object CSV. */
export function downloadGcsObject(
  account: { clientEmail: string; privateKey: string },
  bucket: string,
  objectName: string,
): Promise<string> {
  const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}?alt=media`;
  return getGoogleText(account, GCS_SCOPE, url);
}
