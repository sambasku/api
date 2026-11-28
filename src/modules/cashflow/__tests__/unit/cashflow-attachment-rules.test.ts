import { describe, it, expect } from 'vitest';
import {
  buildObjectKey,
  detectAttachmentMime,
  sha256Hex,
} from '../../domain/cashflow-attachment-rules';

const enc = (s: string) => new TextEncoder().encode(s);

describe('deteksi jenis lampiran dari isi file', () => {
  it('mengenali PDF, JPG, PNG, dan WebP dari magic bytes', () => {
    expect(detectAttachmentMime(enc('%PDF-1.7 isi'))).toBe('application/pdf');
    expect(detectAttachmentMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toBe('image/jpeg');
    expect(
      detectAttachmentMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])),
    ).toBe('image/png');
    expect(detectAttachmentMime(enc('RIFF\u0000\u0000\u0000\u0000WEBPVP8 '))).toBe('image/webp');
  });

  it('menolak file yang hanya mengaku PDF lewat nama atau mime', () => {
    expect(detectAttachmentMime(enc('halo dunia'))).toBeNull();
    expect(detectAttachmentMime(enc('RIFF\u0000\u0000\u0000\u0000WAVE'))).toBeNull();
    expect(detectAttachmentMime(new Uint8Array(0))).toBeNull();
  });
});

describe('object key privat', () => {
  it('memakai tanggal transaksi dan ekstensi dari jenis asli, tanpa nama file', () => {
    expect(buildObjectKey('TX-1', '2026-11-28', 'LAMP-1', 'application/pdf')).toBe(
      'cashflow/2026/11/TX-1/LAMP-1.pdf',
    );
    expect(buildObjectKey('TX-1', '2026-12-03', 'LAMP-2', 'image/jpeg')).toBe(
      'cashflow/2026/12/TX-1/LAMP-2.jpg',
    );
  });
});

describe('sha256', () => {
  it('cocok dengan vektor uji standar', async () => {
    expect(await sha256Hex(enc('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
