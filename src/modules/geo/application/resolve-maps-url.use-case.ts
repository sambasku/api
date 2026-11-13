import { BadRequestError } from '@/shared/errors/app-error';
import { SAMBAS_NOMINATIM_VIEWBOX } from '@/shared/constants/sambas-bounds';
import {
  buildPlaceGeocodeCandidates,
  cleanCanonicalMapsUrl,
  extractCoordsFromMapsUrl,
  extractHttpsUrl,
  extractMapsFeatureId,
  extractPlaceNameFromMapsUrl,
  extractPlusCodeFromMapsUrl,
  inSambasBounds,
  isAllowedMapsUrl,
  isShortMapsUrl,
  mapsFeatureIdToCid,
  type MapsCoords,
} from './parse-maps-url';
import { coordsFromPlusCode } from './plus-code-coords';

export type ResolveMapsUrlResult = {
  lat: number;
  lng: number;
  canonical_url: string;
};

export type ResolveMapsUrlDeps = {
  fetch: typeof fetch;
  /** Max hop redirect. Default 5. */
  maxRedirects?: number;
  /** Timeout per hop ms. Default 5000. */
  timeoutMs?: number;
};

/** Identitas Nominatim (wajib). */
const NOMINATIM_UA = 'SambasKu/1.0 (maps-url-resolve; https://sambasku.com)';

/**
 * Browser UA untuk fetch Google (expand + tbm=map).
 * Bot UA sering dapat halaman tanpa `@`/`!3d`.
 */
const MAPS_FETCH_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

export class ResolveMapsUrlUseCase {
  constructor(private readonly deps: ResolveMapsUrlDeps) {}

  async execute(rawUrl: string): Promise<ResolveMapsUrlResult> {
    const extracted = extractHttpsUrl(rawUrl);
    if (!extracted || !isAllowedMapsUrl(extracted)) {
      throw new BadRequestError(
        'MAPS_URL_INVALID',
        'Tautan itu bukan Google Maps yang kami kenali. Tempel tautan share dari Maps ya.',
      );
    }

    let working = extracted;
    let coords = extractCoordsFromMapsUrl(working);

    // Short link: sama acuan produk - follow redirect lalu baca URL
    // final (response.url) dan ambil !3d!4d / @ / q.
    if (!coords && isShortMapsUrl(working)) {
      working = await this.expandShortUrl(working);
      coords = extractCoordsFromMapsUrl(working);
    }

    // Share GPS Google: 1 hop HTTP ke place-id (tanpa !3d/@ di Location).
    // Browser JS baru menulis !3d ke address bar - fetch biasa tidak ikut.
    // 1) Plus Code di path (offline)
    // 2) Google search tbm=map / embed cid → body sering punya @lat,lng / !3d
    // 3) Nominatim nama/desa
    if (!coords) {
      const plus = extractPlusCodeFromMapsUrl(working);
      if (plus) {
        coords = coordsFromPlusCode(plus);
      }
    }

    if (!coords) {
      coords = await this.lookupGoogleMapsPin(working);
    }

    if (!coords) {
      const placeName = extractPlaceNameFromMapsUrl(working);
      if (placeName) {
        coords = await this.geocodePlaceName(placeName);
      }
    }

    if (!coords) {
      throw new BadRequestError(
        'MAPS_URL_NO_COORDS',
        'Tautan Maps tidak punya titik. Di Maps, share pin lokasinya (bukan hasil pencarian teks) lalu tempel lagi.',
      );
    }

    if (!inSambasBounds(coords.lat, coords.lng)) {
      throw new BadRequestError(
        'MAPS_URL_OUT_OF_BOUNDS',
        'Titik di tautan di luar Kabupaten Sambas. Pilih lokasi di dalam Sambas ya.',
      );
    }

    const canonical = isAllowedMapsUrl(working)
      ? cleanCanonicalMapsUrl(working)
      : cleanCanonicalMapsUrl(extracted);

    return {
      lat: coords.lat,
      lng: coords.lng,
      canonical_url: canonical,
    };
  }

  private async geocodePlaceName(name: string): Promise<MapsCoords | null> {
    for (const q of buildPlaceGeocodeCandidates(name)) {
      const hit = await this.nominatimSearch(q);
      if (hit) return hit;
    }
    return null;
  }

  private async nominatimSearch(q: string): Promise<MapsCoords | null> {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('q', q);
    url.searchParams.set('countrycodes', 'id');
    url.searchParams.set('viewbox', SAMBAS_NOMINATIM_VIEWBOX);
    url.searchParams.set('bounded', '1');

    const timeoutMs = this.deps.timeoutMs ?? 5000;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    let res: Response;
    try {
      res = await this.deps.fetch(url.toString(), {
        method: 'GET',
        signal: ac.signal,
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'id',
          'User-Agent': NOMINATIM_UA,
        },
      });
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) return null;
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return null;
    }
    if (!Array.isArray(data) || data.length === 0) return null;
    const row = data[0];
    if (!row || typeof row !== 'object') return null;
    const lat = Number((row as { lat?: unknown }).lat);
    const lng = Number((row as { lon?: unknown }).lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
  }

  /**
   * Ambil pin exact yang browser tulis sebagai !3d/@ setelah JS.
   * Fetch `search?tbm=map&q=nama` (atau embed cid) - body sering memuat @lat,lng.
   */
  private async lookupGoogleMapsPin(
    workingUrl: string,
  ): Promise<MapsCoords | null> {
    const placeName = extractPlaceNameFromMapsUrl(workingUrl);
    if (placeName) {
      const fromSearch = await this.fetchMapsSearchCoords(placeName);
      if (fromSearch) return fromSearch;
    }

    const featureId = extractMapsFeatureId(workingUrl);
    const cid = featureId ? mapsFeatureIdToCid(featureId) : null;
    if (cid) {
      const fromEmbed = await this.fetchMapsEmbedCoords(cid);
      if (fromEmbed) return fromEmbed;
    }
    return null;
  }

  private async fetchMapsSearchCoords(
    placeName: string,
  ): Promise<MapsCoords | null> {
    const url = new URL('https://www.google.com/search');
    url.searchParams.set('tbm', 'map');
    url.searchParams.set('hl', 'id');
    url.searchParams.set('q', placeName.slice(0, 160));

    const html = await this.fetchText(url.toString());
    if (!html) return null;
    return extractCoordsFromMapsUrl(html);
  }

  private async fetchMapsEmbedCoords(cid: string): Promise<MapsCoords | null> {
    const html = await this.fetchText(
      `https://www.google.com/maps?cid=${cid}&output=embed`,
    );
    if (!html) return null;
    const fromUrl = extractCoordsFromMapsUrl(html);
    if (fromUrl) return fromUrl;
    // Embed pb sering: [zoom,lng,lat]
    const m =
      /\[(?:[0-9.]+),(-?\d+\.\d+),(-?\d+\.\d+)\]/.exec(html) ??
      null;
    if (!m) return null;
    const lng = Number(m[1]);
    const lat = Number(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
  }

  private async fetchText(url: string): Promise<string | null> {
    const timeoutMs = this.deps.timeoutMs ?? 5000;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await this.deps.fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: ac.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'id,en;q=0.8',
          'User-Agent': MAPS_FETCH_UA,
        },
      });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Expand short link. Prefer `redirect: 'follow'` + `response.url`
   * (pola acuan extractCoordinatesShortUrl). Fallback hop manual bila
   * follow gagal / landas di host non-allowlist.
   */
  private async expandShortUrl(startUrl: string): Promise<string> {
    const timeoutMs = this.deps.timeoutMs ?? 5000;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await this.deps.fetch(startUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: ac.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': MAPS_FETCH_UA,
        },
      });
      // `response.url` terisi setelah follow (acuan extractCoordinatesShortUrl).
      // Mock/fetch tanpa url → jatuh ke hop manual.
      const finalUrl =
        typeof res.url === 'string' && res.url.trim().length > 0
          ? res.url.trim()
          : '';
      if (finalUrl) {
        if (!isAllowedMapsUrl(finalUrl)) {
          throw new BadRequestError(
            'MAPS_URL_INVALID',
            'Tautan Maps dialihkan ke host yang tidak diizinkan.',
          );
        }
        if (!isShortMapsUrl(finalUrl) || extractCoordsFromMapsUrl(finalUrl)) {
          return finalUrl;
        }
      }
    } catch (err) {
      if (err instanceof BadRequestError) throw err;
      // network / abort → hop manual
    } finally {
      clearTimeout(timer);
    }
    return this.followRedirectsManual(startUrl);
  }

  private async followRedirectsManual(startUrl: string): Promise<string> {
    const max = this.deps.maxRedirects ?? 5;
    const timeoutMs = this.deps.timeoutMs ?? 5000;
    let current = startUrl;

    for (let i = 0; i < max; i++) {
      if (!isAllowedMapsUrl(current)) {
        throw new BadRequestError(
          'MAPS_URL_INVALID',
          'Tautan Maps dialihkan ke host yang tidak diizinkan.',
        );
      }

      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), timeoutMs);
      let res: Response;
      try {
        res = await this.deps.fetch(current, {
          method: 'GET',
          redirect: 'manual',
          signal: ac.signal,
          headers: {
            Accept: 'text/html,application/xhtml+xml',
            'User-Agent': MAPS_FETCH_UA,
          },
        });
      } catch {
        throw new BadRequestError(
          'MAPS_URL_RESOLVE_FAILED',
          'Gagal membuka tautan Maps. Coba lagi sebentar, atau tempel tautan panjangnya.',
        );
      } finally {
        clearTimeout(timer);
      }

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) {
          throw new BadRequestError(
            'MAPS_URL_RESOLVE_FAILED',
            'Gagal membuka tautan Maps. Coba lagi sebentar, atau tempel tautan panjangnya.',
          );
        }
        try {
          current = new URL(loc, current).toString();
        } catch {
          throw new BadRequestError(
            'MAPS_URL_INVALID',
            'Tautan Maps dialihkan ke alamat yang tidak valid.',
          );
        }
        if (!isAllowedMapsUrl(current)) {
          throw new BadRequestError(
            'MAPS_URL_INVALID',
            'Tautan Maps dialihkan ke host yang tidak diizinkan.',
          );
        }
        // Sudah punya koordinat atau bukan short link lagi → selesai.
        if (extractCoordsFromMapsUrl(current) || !isShortMapsUrl(current)) {
          return current;
        }
        continue;
      }

      // 2xx / lain: pakai URL kerja saat ini (short link jarang 200 tanpa redirect).
      return current;
    }

    throw new BadRequestError(
      'MAPS_URL_RESOLVE_FAILED',
      'Tautan Maps terlalu banyak dialihkan. Tempel tautan panjang dari share ya.',
    );
  }
}
