/**
 * Parse & validasi tautan Google Maps (tanpa Places API).
 * Short link di-expand di use-case lewat fetch redirect.
 */

/** Kotak produk Kabupaten Sambas - selaras mobile `inSambasBounds`. */
export function inSambasBounds(lat: number, lng: number): boolean {
  return lat >= 1.0 && lat <= 1.8 && lng >= 108.5 && lng <= 110.0;
}

const MAX_URL_LEN = 2048;

/** Ambil URL https pertama dari teks paste (boleh ada spasi/newline). */
export function extractHttpsUrl(raw: string): string | null {
  const trimmed = raw.replace(/\s+/g, ' ').trim();
  if (!trimmed || trimmed.length > MAX_URL_LEN) return null;
  const match = /https:\/\/[^\s<>"']+/i.exec(trimmed);
  if (!match) return null;
  let url = match[0].replace(/[.,;)\]]+$/g, '');
  if (url.length > MAX_URL_LEN) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function isAllowedMapsUrl(urlStr: string): boolean {
  let u: URL;
  try {
    u = new URL(urlStr);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase();
  const path = u.pathname;
  if (host === 'maps.app.goo.gl') return true;
  if (host === 'goo.gl' && path.startsWith('/maps')) return true;
  if (host === 'maps.google.com') return true;
  if (
    (host === 'google.com' || host.endsWith('.google.com')) &&
    path.startsWith('/maps')
  ) {
    return true;
  }
  return false;
}

export function isShortMapsUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    return (
      host === 'maps.app.goo.gl' ||
      (host === 'goo.gl' && u.pathname.startsWith('/maps'))
    );
  } catch {
    return false;
  }
}

export type MapsCoords = { lat: number; lng: number };

function finitePair(a: string, b: string): MapsCoords | null {
  const lat = Number(a);
  const lng = Number(b);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/**
 * Prioritas: pin place `!3d!4d` > kamera `/@lat,lng` > q/ll/query.
 * Beberapa `!3d` bisa muncul; ambil yang terakhir (biasanya pin tempat).
 */
export function extractCoordsFromMapsUrl(urlStr: string): MapsCoords | null {
  let decoded = urlStr;
  try {
    decoded = decodeURIComponent(urlStr);
  } catch {
    // pakai mentah
  }

  const pinMatches = [
    ...decoded.matchAll(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/g),
  ];
  if (pinMatches.length > 0) {
    const last = pinMatches[pinMatches.length - 1]!;
    const pair = finitePair(last[1]!, last[2]!);
    if (pair) return pair;
  }

  const at = /@(-?\d+\.?\d*),(-?\d+\.?\d*)/.exec(decoded);
  if (at) {
    const pair = finitePair(at[1]!, at[2]!);
    if (pair) return pair;
  }

  const q = /[?&](?:q|query|ll)=(-?\d+\.?\d*),(-?\d+\.?\d*)/.exec(decoded);
  if (q) {
    const pair = finitePair(q[1]!, q[2]!);
    if (pair) return pair;
  }

  return null;
}

/** Buang tracking query; URL di DB tetap bersih. */
export function cleanCanonicalMapsUrl(urlStr: string): string {
  let u: URL;
  try {
    u = new URL(urlStr);
  } catch {
    return urlStr;
  }
  const drop = new Set([
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'g_ep',
    'g_st',
    'entry',
  ]);
  for (const key of [...u.searchParams.keys()]) {
    if (drop.has(key) || key.startsWith('utm_')) {
      u.searchParams.delete(key);
    }
  }
  return u.toString();
}
