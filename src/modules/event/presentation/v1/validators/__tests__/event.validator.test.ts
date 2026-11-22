import { describe, expect, it } from 'vitest';
import { createEventBodySchema } from '../event.validator';

describe('createEventBodySchema', () => {
  it('menerima lokasi acara di luar Kab. Sambas', () => {
    const parsed = createEventBodySchema.safeParse({
      slug: 'festival-pontianak',
      name: 'Festival Kaltbar',
      description: 'Acara di luar kota',
      category_id: 'budaya',
      starts_at: '2026-12-01T10:00:00.000Z',
      location_text: 'Pontianak',
      lat: -0.0469556,
      lng: 109.3438961,
    });
    expect(parsed.success).toBe(true);
  });
});