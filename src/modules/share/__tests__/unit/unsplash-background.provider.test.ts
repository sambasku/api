import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildUnsplashSearchUrl,
  UnsplashBackgroundProvider,
} from '../../infrastructure/unsplash-background.provider';
import { trackUnsplashDownloadBodySchema } from '../../presentation/v1/validators/share-backgrounds.validator';

describe('buildUnsplashSearchUrl', () => {
  it('selalu content_filter=high', () => {
    const url = buildUnsplashSearchUrl('makan', 1, '12', 'portrait');
    expect(url.searchParams.get('content_filter')).toBe('high');
    expect(url.searchParams.get('query')).toBe('makan');
  });
});

describe('UnsplashBackgroundProvider.trackDownload', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('GET /photos/:id/download dengan Client-ID', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const ok = await new UnsplashBackgroundProvider('key-123').trackDownload('Abc_-9');

    expect(ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.unsplash.com/photos/Abc_-9/download');
    expect((init.headers as Record<string, string>).Authorization).toBe('Client-ID key-123');
  });

  it('upstream gagal / tanpa kunci → false, tidak melempar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down'); }));
    expect(await new UnsplashBackgroundProvider('key').trackDownload('x')).toBe(false);
    expect(await new UnsplashBackgroundProvider('  ').trackDownload('x')).toBe(false);
  });
});

describe('trackUnsplashDownloadBodySchema', () => {
  it('tolak id dengan path / karakter asing', () => {
    expect(trackUnsplashDownloadBodySchema.safeParse({ id: 'Abc_-9' }).success).toBe(true);
    for (const id of ['', '../x', 'a/b', 'a?b', 'x'.repeat(65)]) {
      expect(trackUnsplashDownloadBodySchema.safeParse({ id }).success).toBe(false);
    }
  });
});
