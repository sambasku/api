import { describe, it, expect } from 'vitest';
import {
  cuisinePhotoRef,
  parseCuisinePhotoRef,
  photoUrlHash,
} from '../../domain/photo-ref';

describe('photo-ref', () => {
  it('hash stabil dan 16 hex', () => {
    const a = photoUrlHash('https://ik.imagekit.io/sambasku/a.webp');
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(photoUrlHash('https://ik.imagekit.io/sambasku/a.webp')).toBe(a);
  });

  it('URL berbeda = hash berbeda', () => {
    expect(photoUrlHash('https://x/a.webp')).not.toBe(photoUrlHash('https://x/b.webp'));
  });

  it('ref kuliner bisa di-parse balik', () => {
    const ref = cuisinePhotoRef('01CUISINE000000000000000001', 'https://x/a.webp');
    const parsed = parseCuisinePhotoRef(ref);
    expect(parsed).toEqual({
      cuisineId: '01CUISINE000000000000000001',
      hash: photoUrlHash('https://x/a.webp'),
    });
  });

  it('ref tidak valid = null', () => {
    expect(parseCuisinePhotoRef('tanpa-titik')).toBeNull();
    expect(parseCuisinePhotoRef('.abc')).toBeNull();
    expect(parseCuisinePhotoRef('abc.')).toBeNull();
  });
});
