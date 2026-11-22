import { describe, expect, it } from 'vitest';
import { submitUsahaContributionBodySchema } from '../usaha-contribution.validator';

describe('submitUsahaContributionBodySchema', () => {
  it('menerima pin di luar Sambas pada usulan baru', () => {
    const parsed = submitUsahaContributionBodySchema.safeParse({
      name: 'Jasa desain online',
      region_id: 'sambas',
      lat: -0.0469556,
      lng: 109.3438961,
    });
    expect(parsed.success).toBe(true);
  });
});