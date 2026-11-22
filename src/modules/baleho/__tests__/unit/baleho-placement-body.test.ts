import { describe, expect, it } from 'vitest';
import { createBalehoPlacementBodySchema } from '../../presentation/v1/validators/baleho.validator';

const bookingExtras = {
  starts_on: '2026-11-22',
  confirmation_phone: '6281234567890',
};

const baseFrame = {
  media_type: 'image' as const,
  media_url: 'https://cdn.example.com/a.jpg',
  action_type: 'external' as const,
  action_payload: 'https://contoh.id',
};

describe('createBalehoPlacementBodySchema', () => {
  it('izinkan portrait 2x4 (h=4, w=2)', () => {
    const parsed = createBalehoPlacementBodySchema.safeParse({
      slide: 1,
      col: 0,
      row: 0,
      w: 2,
      h: 4,
      frames: [baseFrame],
      ...bookingExtras,
    });
    expect(parsed.success).toBe(true);
  });

  it('tolak h>2 bila w juga >2 (mis. 3x3)', () => {
    const parsed = createBalehoPlacementBodySchema.safeParse({
      slide: 1,
      col: 0,
      row: 0,
      w: 3,
      h: 3,
      frames: [baseFrame],
      ...bookingExtras,
    });
    expect(parsed.success).toBe(false);
  });

  it('tolak area keluar papan (row+h > 6)', () => {
    const parsed = createBalehoPlacementBodySchema.safeParse({
      slide: 1,
      col: 0,
      row: 3,
      w: 2,
      h: 4,
      frames: [baseFrame],
      ...bookingExtras,
    });
    expect(parsed.success).toBe(false);
  });
});
