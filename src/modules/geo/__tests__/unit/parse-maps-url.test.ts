import { describe, expect, it } from 'vitest';
import {
  cleanCanonicalMapsUrl,
  extractCoordsFromMapsUrl,
  extractHttpsUrl,
  buildPlaceGeocodeCandidates,
  extractPlaceNameFromMapsUrl,
  extractPlusCodeFromMapsUrl,
  extractPlusCodeFromText,
  inSambasBounds,
  isAllowedMapsUrl,
  isShortMapsUrl,
} from '../../application/parse-maps-url';
import { coordsFromPlusCode } from '../../application/plus-code-coords';

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
  it('terima pusat dan Temajuk, tolak luar kotak', () => {
    expect(inSambasBounds(1.36, 109.3)).toBe(true);
    expect(inSambasBounds(1.997, 109.595)).toBe(true); // Temajuk
    expect(inSambasBounds(-6.2, 106.8)).toBe(false);
    expect(inSambasBounds(2.5, 109.3)).toBe(false);
  });
});

describe('extractPlaceNameFromMapsUrl', () => {
  it('ambil nama dari path /maps/place/', () => {
    expect(
      extractPlaceNameFromMapsUrl(
        'https://www.google.com/maps/place/Temajuk,+Kec.+Paloh,+Kabupaten+Sambas,+Kalimantan+Barat/data=!4m2!3m1!1s0x31e5337401887c35:0x50f63442eed2ad98',
      ),
    ).toBe('Temajuk, Kec. Paloh, Kabupaten Sambas, Kalimantan Barat');
  });

  it('null bila bukan place path / hanya koordinat', () => {
    expect(
      extractPlaceNameFromMapsUrl('https://www.google.com/maps?q=1.36,109.3'),
    ).toBeNull();
    expect(
      extractPlaceNameFromMapsUrl(
        'https://www.google.com/maps/place/1.36,109.30/@1.36,109.30,17z',
      ),
    ).toBeNull();
  });
});

describe('buildPlaceGeocodeCandidates', () => {
  it('prioritas nama pendek + tanpa prefiks admin', () => {
    expect(
      buildPlaceGeocodeCandidates(
        'Temajuk, Kec. Paloh, Kabupaten Sambas, Kalimantan Barat',
      ),
    ).toEqual(['Temajuk', 'Temajuk Paloh Sambas']);
  });

  it('nama sederhana tanpa admin → satu kandidat', () => {
    expect(buildPlaceGeocodeCandidates('Pasar Sambas')).toEqual([
      'Pasar Sambas',
    ]);
  });

  it('buang Plus Code di depan nama POI', () => {
    expect(
      buildPlaceGeocodeCandidates(
        'F6HG+CFG Sakura Mart, Jl. Jembatan Besi, Sungai Serabek, Kec. Tlk. Keramat, Kabupaten Sambas',
      )[0],
    ).toBe('Sakura Mart');
  });
});

describe('Plus Code dari share GPS Maps', () => {
  it('extract F6HG+CFG dari path %2B', () => {
    const url =
      'https://www.google.com/maps/place/F6HG%2BCFG+Sakura+Mart,+Jl.+Jembatan+Besi,+Sungai+Serabek,+Kec.+Tlk.+Keramat,+Kabupaten+Sambas,+Kalimantan+Barat+79465/data=!4m2!3m1!1s0x31e4c1ae5df10b3b:0x9339a4183049c394';
    expect(extractPlusCodeFromMapsUrl(url)).toBe('F6HG+CFG');
    expect(extractPlusCodeFromText('F6HG+CFG Sakura Mart')).toBe('F6HG+CFG');
  });

  it('decode dekat pin Sakuramart (~1.6 m)', () => {
    const coords = coordsFromPlusCode('F6HG+CFG');
    expect(coords).not.toBeNull();
    expect(coords!.lat).toBeCloseTo(1.4785743, 3);
    expect(coords!.lng).toBeCloseTo(109.2261941, 3);
    expect(inSambasBounds(coords!.lat, coords!.lng)).toBe(true);
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
