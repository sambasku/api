import { describe, expect, it } from 'vitest';
import {
  cleanCanonicalMapsUrl,
  extractCoordsFromMapsUrl,
  extractHttpsUrl,
  inSambasBounds,
  isAllowedMapsUrl,
  isShortMapsUrl,
} from '../../application/parse-maps-url';

describe('extractHttpsUrl', () => {
  it('ambil URL dari teks ber-spasi/newline', () => {
    expect(
      extractHttpsUrl('  lihat\nhttps://maps.app.goo.gl/abc123  ya'),
    ).toBe('https://maps.app.goo.gl/abc123');
  });

  it('null untuk kosong / non-https / terlalu panjang', () => {
    expect(extractHttpsUrl('')).toBeNull();
    expect(extractHttpsUrl('http://maps.app.goo.gl/x')).toBeNull();
    expect(extractHttpsUrl(`https://maps.app.goo.gl/${'a'.repeat(2100)}`)).toBeNull();
  });
});

describe('isAllowedMapsUrl / isShortMapsUrl', () => {
  it('terima host Maps yang dikenal', () => {
    expect(isAllowedMapsUrl('https://maps.app.goo.gl/abc')).toBe(true);
    expect(isAllowedMapsUrl('https://goo.gl/maps/abc')).toBe(true);
    expect(
      isAllowedMapsUrl('https://www.google.com/maps/place/Foo/@1.2,109.0,17z'),
    ).toBe(true);
    expect(isAllowedMapsUrl('https://maps.google.com/?q=1.2,109.0')).toBe(true);
  });

  it('tolak host asing & path non-maps', () => {
    expect(isAllowedMapsUrl('https://evil.test/maps')).toBe(false);
    expect(isAllowedMapsUrl('https://www.google.com/search?q=1')).toBe(false);
    expect(isAllowedMapsUrl('http://maps.app.goo.gl/x')).toBe(false);
  });

  it('short link hanya goo.gl maps', () => {
    expect(isShortMapsUrl('https://maps.app.goo.gl/abc')).toBe(true);
    expect(isShortMapsUrl('https://goo.gl/maps/abc')).toBe(true);
    expect(
      isShortMapsUrl('https://www.google.com/maps/place/Foo/@1.2,109.0,17z'),
    ).toBe(false);
  });
});

describe('extractCoordsFromMapsUrl', () => {
  it('prioritas !3d!4d di atas @ kamera', () => {
    const url =
      'https://www.google.com/maps/place/Foo/@1.10,109.10,17z/data=!3m1!1e3!4m6!3m5!1s0x0:0x0!8m2!3d1.36!4d109.30';
    expect(extractCoordsFromMapsUrl(url)).toEqual({ lat: 1.36, lng: 109.3 });
  });

  it('pakai @lat,lng bila tidak ada pin', () => {
    expect(
      extractCoordsFromMapsUrl(
        'https://www.google.com/maps/place/Foo/@1.36,109.30,17z',
      ),
    ).toEqual({ lat: 1.36, lng: 109.3 });
  });

  it('pakai q= / ll=', () => {
    expect(
      extractCoordsFromMapsUrl('https://maps.google.com/?q=1.36,109.30'),
    ).toEqual({ lat: 1.36, lng: 109.3 });
    expect(
      extractCoordsFromMapsUrl(
        'https://www.google.com/maps?ll=1.40,109.20&z=15',
      ),
    ).toEqual({ lat: 1.4, lng: 109.2 });
  });

  it('null bila tanpa koordinat', () => {
    expect(
      extractCoordsFromMapsUrl('https://www.google.com/maps/place/Pasar+Sambas'),
    ).toBeNull();
  });
});

describe('inSambasBounds', () => {
  it('terima pusat, tolak luar kotak', () => {
    expect(inSambasBounds(1.36, 109.3)).toBe(true);
    expect(inSambasBounds(-6.2, 106.8)).toBe(false);
  });
});

describe('cleanCanonicalMapsUrl', () => {
  it('buang utm & tracking', () => {
    const cleaned = cleanCanonicalMapsUrl(
      'https://www.google.com/maps/place/Foo/@1.36,109.30,17z?utm_source=x&g_ep=1&q=keep',
    );
    expect(cleaned).not.toContain('utm_source');
    expect(cleaned).not.toContain('g_ep');
    expect(cleaned).toContain('q=keep');
  });
});
