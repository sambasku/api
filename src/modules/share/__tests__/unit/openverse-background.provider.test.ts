import { describe, expect, it } from 'vitest';
import {
  OPENVERSE_SAFE_LICENSES,
  buildOpenverseSearchUrl,
  mapOpenversePhoto,
  openverseLicenseLabel,
} from '../../infrastructure/openverse-background.provider';

describe('buildOpenverseSearchUrl', () => {
  it('selalu mature=false + license cc0,pdm,by, tanpa param sensitive', () => {
    const url = buildOpenverseSearchUrl('makan', 1, '12');
    expect(url.searchParams.get('mature')).toBe('false');
    expect(url.searchParams.get('license')).toBe('cc0,pdm,by');
    expect(OPENVERSE_SAFE_LICENSES).toBe('cc0,pdm,by');
    expect(
      url.searchParams.get('unstable__include_sensitive_results'),
    ).toBeNull();
  });
});

describe('openverseLicenseLabel', () => {
  it('label lisensi CC yang dikenal', () => {
    expect(openverseLicenseLabel('by', '2.0')).toBe('CC BY 2.0');
    expect(openverseLicenseLabel('cc0', '1.0')).toBe('CC0 1.0');
    expect(openverseLicenseLabel('pdm', '1.0')).toBe('Public Domain Mark 1.0');
  });
});

describe('mapOpenversePhoto', () => {
  const base = {
    id: 'abc-1',
    url: 'https://example.com/a.jpg',
    creator: 'Ada',
    license: 'by',
    license_version: '2.0',
  };

  it('map url + creator + lisensi + sumber ke item foto', () => {
    const item = mapOpenversePhoto({
      ...base,
      thumbnail: 'https://example.com/a-thumb.jpg',
      foreign_landing_url: 'https://www.flickr.com/photos/x/1',
      license_url: 'https://creativecommons.org/licenses/by/2.0/',
      source: 'flickr',
      width: 1080,
      height: 1620,
      mature: false,
      unstable__sensitivity: [],
    });
    expect(item).toMatchObject({
      id: 'openverse-photo-abc-1',
      kind: 'photo',
      provider: 'openverse',
      url: 'https://example.com/a.jpg',
      preview_url: 'https://example.com/a-thumb.jpg',
      photographer: 'Ada',
      attribution_url: 'https://www.flickr.com/photos/x/1',
      license: 'CC BY 2.0',
      license_url: 'https://creativecommons.org/licenses/by/2.0/',
      source: 'flickr',
    });
  });

  it('tolak lisensi di luar allowlist (by-sa / by-nc / kosong)', () => {
    expect(mapOpenversePhoto({ ...base, license: 'by-sa' })).toBeNull();
    expect(mapOpenversePhoto({ ...base, license: 'by-nc' })).toBeNull();
    expect(mapOpenversePhoto({ ...base, license: undefined })).toBeNull();
  });

  it('tolak mature atau sensitive', () => {
    expect(mapOpenversePhoto({ ...base, mature: true })).toBeNull();
    expect(
      mapOpenversePhoto({ ...base, unstable__sensitivity: ['sensitive'] }),
    ).toBeNull();
  });

  it('tolak tanpa url', () => {
    expect(mapOpenversePhoto({ ...base, url: undefined })).toBeNull();
  });
});
