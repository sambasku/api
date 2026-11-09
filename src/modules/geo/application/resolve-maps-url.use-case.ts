import { BadRequestError } from '@/shared/errors/app-error';
import { SAMBAS_NOMINATIM_VIEWBOX } from '@/shared/constants/sambas-bounds';
import {
  buildPlaceGeocodeCandidates,
  cleanCanonicalMapsUrl,
  extractCoordsFromMapsUrl,
  extractHttpsUrl,
  extractPlaceNameFromMapsUrl,
  inSambasBounds,
  isAllowedMapsUrl,
  isShortMapsUrl,
  type MapsCoords,
} from './parse-maps-url';

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

const UA = 'SambasKu/1.0 (maps-url-resolve; https://sambasku.com)';

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

    if (!coords && isShortMapsUrl(working)) {
      working = await this.followRedirects(working);
      coords = extractCoordsFromMapsUrl(working);
    }

    // Short/place share sering hanya place-id (tanpa !3d/@). Fallback:
    // geocode nama di path lewat Nominatim (tanpa Google Places API).
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
          'User-Agent': UA,
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

  private async followRedirects(startUrl: string): Promise<string> {
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
            'User-Agent': UA,
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
