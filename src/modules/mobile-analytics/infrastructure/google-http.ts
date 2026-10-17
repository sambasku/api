import {
  getGoogleAccessToken,
  GoogleTokenError,
  type GoogleServiceAccount,
} from '@/shared/google/service-account-token';
import { MobileAnalyticsProviderError } from '../application/ports/mobile-analytics.port';

const TIMEOUT_MS = 10_000;

function kindForStatus(status: number): MobileAnalyticsProviderError['kind'] {
  if (status === 401 || status === 403) return 'permission_denied';
  if (status === 429) return 'rate_limited';
  return 'upstream';
}

function toError(err: unknown): MobileAnalyticsProviderError {
  if (err instanceof MobileAnalyticsProviderError) return err;
  if (err instanceof GoogleTokenError) {
    const kind = err.status === 0 ? 'network' : err.status >= 500 ? 'upstream' : 'permission_denied';
    return new MobileAnalyticsProviderError(kind, err.message);
  }
  return new MobileAnalyticsProviderError('upstream', (err as Error).message);
}

/** POST JSON ke Google Data API dengan token service account. */
export async function postGoogleJson<T>(account: GoogleServiceAccount, scope: string, url: string, body: unknown): Promise<T> {
  let token: string;
  try {
    token = await getGoogleAccessToken(account, scope);
  } catch (err) {
    throw toError(err);
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
    throw new MobileAnalyticsProviderError('network', (err as Error).message);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new MobileAnalyticsProviderError(kindForStatus(res.status), `status=${res.status} ${text.slice(0, 300)}`);
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new MobileAnalyticsProviderError('upstream', 'Respons Google bukan JSON');
  }
}
