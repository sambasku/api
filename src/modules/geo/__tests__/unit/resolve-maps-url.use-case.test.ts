import { describe, expect, it, vi } from 'vitest';
import { BadRequestError } from '@/shared/errors/app-error';
import { ResolveMapsUrlUseCase } from '../../application/resolve-maps-url.use-case';

function redirect(to: string, status = 302): Response {
  return new Response(null, {
    status,
    headers: { Location: to },
  });
}

/** Response follow dengan `url` final (pola browser / undici). */
function followed(to: string): Response {
  const res = new Response('', { status: 200 });
  Object.defineProperty(res, 'url', { value: to });
  return res;
}

describe('ResolveMapsUrlUseCase', () => {
  it('parse langsung tanpa fetch bila URL sudah punya koordinat', async () => {
    const fetchMock = vi.fn();
    const uc = new ResolveMapsUrlUseCase({ fetch: fetchMock });
    const result = await uc.execute(
      'https://www.google.com/maps/place/Foo/@1.36,109.30,17z',
    );
    expect(result.lat).toBe(1.36);
    expect(result.lng).toBe(109.3);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ikuti short link lalu ambil koordinat (response.url + !3d/@)', async () => {
    const long =
      'https://www.google.com/maps/place/Foo/@1.36,109.30,17z?utm_source=share';
    const fetchMock = vi.fn().mockResolvedValue(followed(long));
    const uc = new ResolveMapsUrlUseCase({ fetch: fetchMock });
    const result = await uc.execute('https://maps.app.goo.gl/abc123');
    expect(result).toEqual({
      lat: 1.36,
      lng: 109.3,
      canonical_url:
        'https://www.google.com/maps/place/Foo/@1.36,109.30,17z',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ redirect: 'follow' });
  });

  it('ambil !3d!4d dari HTML bila URL final hanya place-id', async () => {
    const placeUrl =
      'https://www.google.com/maps/place/Foo/data=!4m2!3m1!1s0xabc:0xdef';
    const html =
      '<html>…!3d1.36!4d109.30… dan kamera @0.1,0.2 diabaikan karena pin terakhir</html>';
    const res = new Response(html, { status: 200 });
    Object.defineProperty(res, 'url', { value: placeUrl });
    const fetchMock = vi.fn().mockResolvedValue(res);
    const uc = new ResolveMapsUrlUseCase({ fetch: fetchMock });
    const result = await uc.execute('https://maps.app.goo.gl/htmlpin');
    expect(result.lat).toBe(1.36);
    expect(result.lng).toBe(109.3);
  });

  it('MAPS_URL_INVALID untuk host asing', async () => {
    const uc = new ResolveMapsUrlUseCase({ fetch: vi.fn() });
    await expect(uc.execute('https://evil.test/maps?q=1,2')).rejects.toMatchObject(
      {
        errorCode: 'MAPS_URL_INVALID',
      } satisfies Partial<BadRequestError>,
    );
  });

  it('MAPS_URL_NO_COORDS bila redirect tanpa angka dan tanpa nama place', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(followed('https://www.google.com/maps?q=Pasar+Sambas'));
    const uc = new ResolveMapsUrlUseCase({ fetch: fetchMock });
    await expect(
      uc.execute('https://maps.app.goo.gl/nocoords'),
    ).rejects.toMatchObject({ errorCode: 'MAPS_URL_NO_COORDS' });
  });

  it('fallback Plus Code bila share GPS hanya place-id tanpa !3d', async () => {
    // Hop HTTP Google berhenti di sini; URL @/!3d hanya muncul lewat JS browser.
    const placeUrl =
      'https://www.google.com/maps/place/F6HG%2BCFG+Sakura+Mart,+Jl.+Jembatan+Besi,+Sungai+Serabek,+Kec.+Tlk.+Keramat,+Kabupaten+Sambas,+Kalimantan+Barat+79465/data=!4m2!3m1!1s0x31e4c1ae5df10b3b:0x9339a4183049c394!18m1!1e1';
    const fetchMock = vi.fn().mockResolvedValue(followed(placeUrl));
    const uc = new ResolveMapsUrlUseCase({ fetch: fetchMock });
    const result = await uc.execute(
      'https://maps.app.goo.gl/Ri3DDfXQpcGfRUhTA?g_st=ac',
    );
    expect(result.lat).toBeCloseTo(1.4785743, 3);
    expect(result.lng).toBeCloseTo(109.2261941, 3);
    // Tidak perlu Nominatim.
    expect(
      fetchMock.mock.calls.some((c) =>
        String(c[0]).includes('nominatim.openstreetmap.org'),
      ),
    ).toBe(false);
  });

  it('ambil !3d/@ dari Google tbm=map bila share GPS tanpa pin di URL', async () => {
    const placeUrl =
      'https://www.google.com/maps/place/Bank+BRI+ATM+-+TERAS+BRI+MATANG+SURI,+Jl.+Stadion,+Sentebang,+Jawai,+Sambas+Regency,+West+Kalimantan+79454/data=!4m2!3m1!1s0x31e49148f61ea8ff:0xd6a3bc8e7525a8fb';
    const fetchMock = vi.fn(async (input: string | Request | URL) => {
      const href = String(input);
      if (href.includes('maps.app.goo.gl')) return followed(placeUrl);
      if (href.includes('google.com/search') && href.includes('tbm=map')) {
        return new Response(
          '…marker @1.3181755,109.0488453 !3d1.3181755!4d109.0488453 …',
          { status: 200 },
        );
      }
      return new Response('not found', { status: 404 });
    });
    const uc = new ResolveMapsUrlUseCase({ fetch: fetchMock });
    const result = await uc.execute('https://maps.app.goo.gl/95xe3PPukVkerjw39');
    expect(result.lat).toBeCloseTo(1.3181755);
    expect(result.lng).toBeCloseTo(109.0488453);
  });

  it('fallback Nominatim desa bila POI tanpa !3d dan tanpa Plus Code', async () => {
    const placeUrl =
      'https://www.google.com/maps/place/Bank+BRI+ATM+-+TERAS+BRI+MATANG+SURI,+Jl.+Stadion,+Sentebang,+Jawai,+Sambas+Regency,+West+Kalimantan+79454/data=!4m2!3m1!1s0x31e49148f61ea8ff:0xd6a3bc8e7525a8fb';
    const fetchMock = vi.fn(async (input: string | Request | URL) => {
      const href = String(input);
      if (href.includes('maps.app.goo.gl')) return followed(placeUrl);
      if (href.includes('google.com/search') && href.includes('tbm=map')) {
        return new Response('no coords here', { status: 200 });
      }
      if (href.includes('output=embed')) {
        return new Response('no coords', { status: 200 });
      }
      if (href.includes('nominatim.openstreetmap.org')) {
        const q = new URL(href).searchParams.get('q') ?? '';
        if (q === 'Sentebang Jawai' || q === 'Sentebang') {
          return Response.json([
            {
              lat: '1.3186986',
              lon: '109.0481387',
              display_name: 'Sentebang, Jawai, Sambas',
            },
          ]);
        }
        return Response.json([]);
      }
      return new Response('not found', { status: 404 });
    });
    const uc = new ResolveMapsUrlUseCase({ fetch: fetchMock });
    const result = await uc.execute('https://maps.app.goo.gl/95xe3PPukVkerjw39');
    expect(result.lat).toBeCloseTo(1.3186986);
    expect(result.lng).toBeCloseTo(109.0481387);
  });

  it('fallback Nominatim bila short link hanya place-id + nama', async () => {
    const placeUrl =
      'https://www.google.com/maps/place/Temajuk,+Kec.+Paloh,+Kabupaten+Sambas,+Kalimantan+Barat/data=!4m2!3m1!1s0x31e5337401887c35:0x50f63442eed2ad98';
    // ponytail: Workers fetch input = string | Request | URL (bukan DOM RequestInfo).
    const fetchMock = vi.fn(async (input: string | Request | URL) => {
      const href = String(input);
      if (href.includes('maps.app.goo.gl')) return followed(placeUrl);
      if (href.includes('nominatim.openstreetmap.org')) {
        const q = new URL(href).searchParams.get('q') ?? '';
        // Nama Google penuh sering 0 hit; kandidat pendek yang kena.
        if (q === 'Temajuk' || q === 'Temajuk Paloh Sambas') {
          return Response.json([
            {
              lat: '1.9967876',
              lon: '109.5950011',
              display_name: 'Temajuk, Paloh, Sambas',
            },
          ]);
        }
        return Response.json([]);
      }
      return new Response('not found', { status: 404 });
    });
    const uc = new ResolveMapsUrlUseCase({ fetch: fetchMock });
    const result = await uc.execute(
      'https://maps.app.goo.gl/2hSqgKSqKL6eaTNE9?g_st=ac',
    );
    expect(result.lat).toBeCloseTo(1.9967876);
    expect(result.lng).toBeCloseTo(109.5950011);
    expect(result.canonical_url).toContain('/maps/place/Temajuk');
  });

  it('MAPS_URL_OUT_OF_BOUNDS untuk titik di luar Sambas', async () => {
    const uc = new ResolveMapsUrlUseCase({ fetch: vi.fn() });
    await expect(
      uc.execute('https://www.google.com/maps?q=-6.2,106.8'),
    ).rejects.toMatchObject({ errorCode: 'MAPS_URL_OUT_OF_BOUNDS' });
  });

  it('MAPS_URL_INVALID bila redirect ke host non-allowlist', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(followed('https://accounts.google.com/ServiceLogin'));
    const uc = new ResolveMapsUrlUseCase({ fetch: fetchMock });
    await expect(
      uc.execute('https://maps.app.goo.gl/logintrap'),
    ).rejects.toMatchObject({ errorCode: 'MAPS_URL_INVALID' });
  });

  it('MAPS_URL_RESOLVE_FAILED saat fetch error', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network'));
    const uc = new ResolveMapsUrlUseCase({ fetch: fetchMock });
    await expect(
      uc.execute('https://maps.app.goo.gl/down'),
    ).rejects.toMatchObject({ errorCode: 'MAPS_URL_RESOLVE_FAILED' });
  });

  it('fallback hop manual bila follow tidak mengisi response.url', async () => {
    const long =
      'https://www.google.com/maps/place/Foo/data=!3d1.36!4d109.30';
    const fetchMock = vi
      .fn()
      // 1) follow tanpa url → expandShortUrl jatuh ke manual
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      // 2) hop manual
      .mockResolvedValueOnce(redirect(long));
    const uc = new ResolveMapsUrlUseCase({ fetch: fetchMock });
    const result = await uc.execute('https://maps.app.goo.gl/manual');
    expect(result.lat).toBe(1.36);
    expect(result.lng).toBe(109.3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
