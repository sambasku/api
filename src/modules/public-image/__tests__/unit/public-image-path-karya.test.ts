import { describe, expect, it } from 'vitest';
import { buildKaryaImagePath } from '../../application/utils/public-image-path';

describe('buildKaryaImagePath', () => {
  it('menyimpan cover/poster di assets/karyas dengan ekstensi mime', () => {
    const path = buildKaryaImagePath('image/jpeg');
    expect(path.startsWith('assets/karyas/')).toBe(true);
    expect(path.endsWith('.jpg')).toBe(true);
  });

  it('pakai png untuk image/png', () => {
    const path = buildKaryaImagePath('image/png');
    expect(path.startsWith('assets/karyas/')).toBe(true);
    expect(path.endsWith('.png')).toBe(true);
  });
});
