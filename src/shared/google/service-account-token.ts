/**
 * OAuth 2.0 service account Google (JWT bearer grant) tanpa SDK: JWT RS256
 * ditandatangani Web Crypto, jadi jalan di Node, Deno, dan Workers.
 * Dipakai FCM, GA4 Data API, dan Search Console API.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
/** Token Google berlaku 1 jam; refresh 5 menit lebih awal. */
const EXPIRY_MARGIN_MS = 5 * 60_000;

export interface GoogleServiceAccount {
  clientEmail: string;
  privateKey: string;
}

/** Gagal tukar JWT ke access token. `status` 0 = gagal jaringan. */
export class GoogleTokenError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GoogleTokenError';
  }
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\\n/g, '')
    .replace(/\s/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function base64url(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]!);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeBase64url(str: string): string {
  return base64url(new TextEncoder().encode(str));
}

async function signRs256(data: string, privateKeyPem: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, key, new TextEncoder().encode(data));
  return base64url(new Uint8Array(signature));
}

// ponytail: cache per isolate; tiap isolate Workers tukar token sendiri (murah, 1x/jam)
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export async function getGoogleAccessToken(account: GoogleServiceAccount, scope: string): Promise<string> {
  const cacheKey = `${account.clientEmail}|${scope}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = { iss: account.clientEmail, scope, aud: TOKEN_URL, exp: now + 3600, iat: now };
  const signingInput = `${encodeBase64url(JSON.stringify(header))}.${encodeBase64url(JSON.stringify(claim))}`;
  const jwt = `${signingInput}.${await signRs256(signingInput, account.privateKey)}`;

  let res: Response;
  try {
    res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
    });
  } catch (err) {
    throw new GoogleTokenError(0, `Google OAuth tidak terjangkau: ${(err as Error).message}`);
  }
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!data.access_token) {
    throw new GoogleTokenError(
      res.status,
      `Google OAuth gagal (status=${res.status}): ${data.error ?? 'unknown'} ${data.error_description ?? ''}`.trim(),
    );
  }
  const ttlMs = (data.expires_in ?? 3600) * 1000;
  tokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + ttlMs - EXPIRY_MARGIN_MS });
  return data.access_token;
}

/** Khusus test - kosongkan cache token antar kasus. */
export function clearGoogleAccessTokenCache(): void {
  tokenCache.clear();
}
