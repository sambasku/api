import { describe, expect, it } from 'vitest';
import { submitEventContributionBodySchema } from '../event-contribution.validator';

describe('submitEventContributionBodySchema', () => {
  it('menerima pin lokasi di luar Sambas pada usulan acara', () => {
    const parsed = submitEventContributionBodySchema.safeParse({
      name: 'Pameran diaspora Sambas',
      category_id: 'budaya',
      starts_at: '2026-06-01T08:00:00.000Z',
      location_text: 'Jakarta',
      lat: -6.2,
      lng: 106.8,
    });
    expect(parsed.success).toBe(true);
  });
});