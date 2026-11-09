import { describe, expect, it, vi } from 'vitest';
import { BadRequestError } from '@/shared/errors/app-error';
import { ResolveMapsUrlUseCase } from '../../application/resolve-maps-url.use-case';

function redirect(to: string, status = 302): Response {
  return new Response(null, {
    status,
    headers: { Location: to },
  });
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

  it('ikuti short link lalu ambil koordinat', async () => {
    const long =
      'https://www.google.com/maps/place/Foo/@1.36,109.30,17z?utm_source=share';
    const fetchMock = vi.fn().mockResolvedValue(redirect(long));
    const uc = new ResolveMapsUrlUseCase({ fetch: fetchMock });
    const result = await uc.execute('https://maps.app.goo.gl/abc123');
    expect(result).toEqual({
      lat: 1.36,
      lng: 109.3,
      canonical_url:
        'https://www.google.com/maps/place/Foo/@1.36,109.30,17z',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('MAPS_URL_INVALID untuk host asing', async () => {
    const uc = new ResolveMapsUrlUseCase({ fetch: vi.fn() });
    await expect(uc.execute('https://evil.test/maps?q=1,2')).rejects.toMatchObject(
      {
        errorCode: 'MAPS_URL_INVALID',
      } satisfies Partial<BadRequestError>,
    );
  });

  it('MAPS_URL_NO_COORDS bila redirect tanpa angka', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        redirect('https://www.google.com/maps/place/Pasar+Sambas'),
      );
    const uc = new ResolveMapsUrlUseCase({ fetch: fetchMock });
    await expect(
      uc.execute('https://maps.app.goo.gl/nocoords'),
    ).rejects.toMatchObject({ errorCode: 'MAPS_URL_NO_COORDS' });
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
      .mockResolvedValue(redirect('https://accounts.google.com/ServiceLogin'));
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
});
