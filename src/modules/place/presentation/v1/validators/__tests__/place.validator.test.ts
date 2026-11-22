import { describe, expect, it } from 'vitest';
import { createPlaceBodySchema } from '../place.validator';

describe('createPlaceBodySchema', () => {
  it('menolak lat di luar bbox Sambas (wisata)', () => {
    const parsed = createPlaceBodySchema.safeParse({
      slug: 'pendopo-kaltbar',
      name: 'Pendopo Gubernur',
      category: 'landmark',
      lat: -0.0469556,
      lng: 109.3438961,
    });
    expect(parsed.success).toBe(false);
  });

  it('menerima koordinat di dalam Sambas', () => {
    const parsed = createPlaceBodySchema.safeParse({
      slug: 'temajuk',
      name: 'Temajuk',
      category: 'alam',
      lat: 1.997,
      lng: 109.595,
    });
    expect(parsed.success).toBe(true);
  });
});