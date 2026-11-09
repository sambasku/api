/**
 * Parse & validasi tautan Google Maps (tanpa Places API).
 * Short link di-expand di use-case lewat fetch redirect.
 */

export {
  inSambasBounds,
  SAMBAS_LAT_MAX,
  SAMBAS_LAT_MIN,
  SAMBAS_LNG_MAX,
  SAMBAS_LNG_MIN,
  SAMBAS_NOMINATIM_VIEWBOX,
} from '@/shared/constants/sambas-bounds';

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

/**
 * Nama tempat dari path `/maps/place/Nama+Tempat/...`.
 * Dipakai fallback geocode bila short link hanya punya place-id (tanpa !3d/@).
 */
export function extractPlaceNameFromMapsUrl(urlStr: string): string | null {
  let u: URL;
  try {
    u = new URL(urlStr);
  } catch {
    return null;
  }
  const match = /^\/maps\/place\/([^/]+)/i.exec(u.pathname);
  if (!match?.[1]) return null;
  let name: string;
  try {
    name = decodeURIComponent(match[1].replace(/\+/g, ' '));
  } catch {
    name = match[1].replace(/\+/g, ' ');
  }
  name = name.replace(/\s+/g, ' ').trim();
  if (name.length < 3 || name.length > 120) return null;
  // Path kadang hanya "lat,lng" - itu bukan nama.
  if (/^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(name)) return null;
  return name;
}

/**
 * Kandidat query Nominatim dari nama Google Maps.
 * Nama penuh Google (dengan "Kec." / "Kabupaten") sering 0 hit;
 * prioritaskan segmen pendek supaya hemat rate limit Nominatim (1 req/dtk).
 */
export function buildPlaceGeocodeCandidates(name: string): string[] {
  const out: string[] = [];
  const push = (raw: string) => {
    const t = raw.replace(/\s+/g, ' ').trim().slice(0, 80);
    if (t.length >= 3 && !out.includes(t)) out.push(t);
  };

  const parts = name
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts[0]) push(parts[0]);

  const cleaned = parts
    .map((p) =>
      p
        .replace(
          /^(kec\.?|kab(?:upaten)?\.?|kota|provinsi|prov\.?)\s+/i,
          '',
        )
        .trim(),
    )
    .filter((p) => p.length >= 2);
  if (cleaned.length >= 2) push(cleaned.slice(0, 3).join(' '));

  // Nama tanpa label admin (mis. "Pasar Sambas") tetap dicoba utuh.
  const hasAdmin = /\b(kec\.?|kab(?:upaten)?|kota|provinsi)\b/i.test(name);
  if (!hasAdmin) push(name);

  return out;
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
