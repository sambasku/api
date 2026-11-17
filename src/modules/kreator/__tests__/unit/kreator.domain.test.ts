import { describe, expect, it } from 'vitest';
import { slugifyKreator } from '../../domain/kreator';

describe('slugifyKreator', () => {
  it('kebab lowercase ascii', () => {
    expect(slugifyKreator('Budi Santoso')).toBe('budi-santoso');
    expect(slugifyKreator('Grup & Kawan')).toBe('grup-kawan');
    expect(slugifyKreator('!!!')).toBe('kreator');
  });
});