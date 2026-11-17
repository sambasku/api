/**
 * Signed URL ImageKit (ik-t + ik-s) - dipakai proxy file privat
 * (bukti bayar Baleho). Algoritma: docs ImageKit "pseudo-code to generate
 * signed URL" - HMAC-SHA1(privateKey, pathAfterEndpoint + expire) hex lower.
 */

async function hmacSha1Hex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    new TextEncoder().encode(message),
  );
  return Array.from(new Uint8Array(signature), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

/** Path relatif setelah urlEndpoint, tanpa query, tanpa leading slash. */
export function imageKitPathAfterEndpoint(url: string, urlEndpoint: string): string {
  const endpoint = urlEndpoint.endsWith('/') ? urlEndpoint : `${urlEndpoint}/`;
  const bare = url.split('?')[0] ?? url;
  const endpointNoSlash = urlEndpoint.replace(/\/$/, '');
  if (!bare.startsWith(endpoint) && !bare.startsWith(endpointNoSlash + '/')) {
    throw new Error('URL di luar IMAGEKIT_URL_ENDPOINT');
  }
  const withoutEndpoint = bare.startsWith(endpoint)
    ? bare.slice(endpoint.length)
    : bare.slice(endpointNoSlash.length + 1);
  return withoutEndpoint.replace(/^\//, '');
}

export async function buildImageKitSignedUrl(args: {
  url: string;
  urlEndpoint: string;
  privateKey: string;
  /** TTL detik dari sekarang (default 60). */
  expiresInSeconds?: number;
  nowSec?: number;
}): Promise<string> {
  const expiresIn = args.expiresInSeconds ?? 60;
  const now = args.nowSec ?? Math.floor(Date.now() / 1000);
  const expire = now + expiresIn;
  const path = imageKitPathAfterEndpoint(args.url, args.urlEndpoint);
  const signature = await hmacSha1Hex(args.privateKey, path + String(expire));
  const base = args.url.split('?')[0] ?? args.url;
  return `${base}?ik-t=${expire}&ik-s=${signature}`;
}
