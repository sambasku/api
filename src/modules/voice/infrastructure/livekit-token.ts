/**
 * Mint LiveKit access JWT (HS256) via WebCrypto - 0 dependency.
 * Grants: roomJoin + publish/subscribe/data (audio room).
 * ponytail: no jti/nbf - LiveKit hanya butuh iss/sub/exp/video grants.
 */

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (const b of view) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

export interface MintLivekitTokenInput {
  identity: string;
  name: string;
  room: string;
  apiKey: string;
  apiSecret: string;
  /** Default 1 jam. */
  ttlSec?: number;
}

export async function mintLivekitAccessToken(
  input: MintLivekitTokenInput,
): Promise<string> {
  const ttl = input.ttlSec ?? 60 * 60;
  const header = b64url(
    enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
  );
  const payload = b64url(
    enc.encode(
      JSON.stringify({
        iss: input.apiKey,
        sub: input.identity,
        name: input.name,
        video: {
          room: input.room,
          roomJoin: true,
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
        },
        exp: Math.floor(Date.now() / 1000) + ttl,
      }),
    ),
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(input.apiSecret),
    enc.encode(`${header}.${payload}`),
  );
  return `${header}.${payload}.${b64url(sig)}`;
}
