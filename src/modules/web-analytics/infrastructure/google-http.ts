import {
  getGoogleAccessToken,
  GoogleTokenError,
  type GoogleServiceAccount,
} from '@/shared/google/service-account-token';
import { AnalyticsProviderError } from '../application/ports/analytics-provider.port';

const TIMEOUT_MS = 10_000;

function kindForStatus(status: number): AnalyticsProviderError['kind'] {
  if (status === 401 || status === 403) return 'permission_denied';
  if (status === 429) return 'rate_limited';
  return 'upstream';
}

/**
 * POST JSON ke Google API dengan token service account. Semua kegagalan
 * (token, jaringan, status) dinormalisasi ke AnalyticsProviderError.
 */
export async function postGoogleJson<T>(
  account: GoogleServiceAccount,
  scope: string,
  url: string,
  body: unknown,
): Promise<T> {
  let token: string;
  try {
    token = await getGoogleAccessToken(account, scope);
  } catch (err) {
    if (err instanceof GoogleTokenError) {
      // invalid_grant / key salah = 400 dari endpoint token: masalah kredensial.
      const kind = err.status === 0 ? 'network' : err.status >= 500 ? 'upstream' : 'permission_denied';
      throw new AnalyticsProviderError(kind, err.message);
    }
    throw new AnalyticsProviderError('permission_denied', `Private key service account tidak valid: ${(err as Error).message}`);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new AnalyticsProviderError('network', (err as Error).message);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new AnalyticsProviderError(kindForStatus(res.status), `status=${res.status} ${text.slice(0, 300)}`);
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new AnalyticsProviderError('upstream', 'Respons Google bukan JSON');
  }
}
