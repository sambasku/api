import { describe, expect, it } from 'vitest';
import {
  assessUgcTextQuality,
  isHeavyCensor,
} from '@/shared/moderation/assert-ugc-text-quality';

describe('assessUgcTextQuality', () => {
  it('menerima teks bermakna biasa', () => {
    const r = assessUgcTextQuality('Ini komentar yang wajar tentang kata Sambas');
    expect(r.ok).toBe(true);
  });

  it('menolak karakter berulang', () => {
    const r = assessUgcTextQuality('aaaaaaaa');
    expect(r.ok).toBe(false);
  });

  it('menolak tanpa huruf', () => {
    const r = assessUgcTextQuality('!!! ??? 123');
    expect(r.ok).toBe(false);
  });

  it('menolak keyboard smash entropy rendah', () => {
    const r = assessUgcTextQuality('ababababababab');
    expect(r.ok).toBe(false);
  });

  it('menolak duplikat exact body baru-baru ini', () => {
    const r = assessUgcTextQuality('Halo dunia', {
      recentBodies: ['  Halo dunia  '],
    });
    expect(r.ok).toBe(false);
  });
});

describe('isHeavyCensor', () => {
  it('true bila sisa teks < 50%', () => {
    expect(isHeavyCensor('kata kotor sangat panjang sekali', '*** *** ***')).toBe(true);
  });

  it('false bila tidak berubah', () => {
    expect(isHeavyCensor('halo', 'halo')).toBe(false);
  });
});
