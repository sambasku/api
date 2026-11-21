import { describe, expect, it } from 'vitest';
import { validateImageFile } from '../../application/utils/validate-image-file';

/** Minimal JPEG (SOI + EOI). */
function jpegBytes(): Uint8Array {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
}

/** Minimal PNG signature + padding. */
function pngBytes(): Uint8Array {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
}

describe('validateImageFile mime sniff', () => {
  it('menerima JPEG bila Content-Type kosong (sniff magic)', () => {
    const r = validateImageFile({ bytes: jpegBytes(), mimeType: null, filename: 'a.jpg' });
    expect(r.mimeType).toBe('image/jpeg');
  });

  it('menerima PNG bila Content-Type application/octet-stream', () => {
    const r = validateImageFile({
      bytes: pngBytes(),
      mimeType: 'application/octet-stream',
      filename: 'a.png',
    });
    expect(r.mimeType).toBe('image/png');
  });

  it('menolak bytes bukan gambar', () => {
    expect(() =>
      validateImageFile({ bytes: new Uint8Array([1, 2, 3]), mimeType: null }),
    ).toThrow();
  });
});
