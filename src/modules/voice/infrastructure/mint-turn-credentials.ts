/**
 * Mint kredensial coturn REST API (time-limited).
 * username = `${expiryEpoch}:${randomId}`
 * credential = base64(HMAC-SHA1(TURN_SECRET, username))
 * WebCrypto saja (Cloudflare Workers) - jangan node:crypto di path runtime.
 */

const enc = new TextEncoder();

export const TURN_CREDENTIAL_TTL_SEC = 86_400;

export const TURN_URLS = [
  'turn:turn.sambasku.com:3478?transport=udp',
  'turn:turn.sambasku.com:3478?transport=tcp',
  'turns:turn.sambasku.com:5349?transport=tcp',
] as const;

function b64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let bin = '';
  for (const b of view) bin += String.fromCharCode(b);
  return btoa(bin);
}

async function hmacSha1Base64(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return b64(signature);
}

export interface MintTurnCredentialsResult {
  urls: string[];
  username: string;
  credential: string;
  ttl: number;
}

export async function mintTurnCredentials(
  secret: string,
  opts?: { nowSec?: number; ttlSec?: number; randomId?: string },
): Promise<MintTurnCredentialsResult> {
  const ttlSec = opts?.ttlSec ?? TURN_CREDENTIAL_TTL_SEC;
  const nowSec = opts?.nowSec ?? Math.floor(Date.now() / 1000);
  const expiry = nowSec + ttlSec;
  const randomId = opts?.randomId ?? crypto.randomUUID().slice(0, 8);
  const username = `${expiry}:${randomId}`;
  const credential = await hmacSha1Base64(secret, username);
  return {
    urls: [...TURN_URLS],
    username,
    credential,
    ttl: ttlSec,
  };
}
