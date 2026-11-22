import { describe, expect, it } from 'vitest';
import { createUsahaBodySchema } from '../usaha.validator';

describe('createUsahaBodySchema', () => {
  it('menerima koordinat di luar bbox Sambas (layanan remote / kantor luar)', () => {
    const parsed = createUsahaBodySchema.safeParse({
      slug: 'konsultan-remote',
      name: 'Konsultan remote',
      lat: -6.2,
      lng: 106.8,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.lat).toBe(-6.2);
      expect(parsed.data.lng).toBe(106.8);
    }
  });
});