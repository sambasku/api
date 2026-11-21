import { describe, expect, it } from 'vitest';
import { isValidBalehoSize } from '@/shared/database/drizzle/schema/baleho.schema';

describe('isValidBalehoSize', () => {
  it('izinkan landscape 4x2 dan portrait 2x4 / 2x3', () => {
    expect(isValidBalehoSize(1, 1)).toBe(true);
    expect(isValidBalehoSize(4, 2)).toBe(true);
    expect(isValidBalehoSize(2, 4)).toBe(true);
    expect(isValidBalehoSize(2, 3)).toBe(true);
    expect(isValidBalehoSize(1, 4)).toBe(true);
    expect(isValidBalehoSize(4, 1)).toBe(true);
  });

  it('tolak kotak besar / sisi pendek > 2', () => {
    expect(isValidBalehoSize(3, 3)).toBe(false);
    expect(isValidBalehoSize(4, 4)).toBe(false);
    expect(isValidBalehoSize(3, 4)).toBe(false);
    expect(isValidBalehoSize(4, 3)).toBe(false);
    expect(isValidBalehoSize(0, 1)).toBe(false);
    expect(isValidBalehoSize(5, 1)).toBe(false);
  });
});
