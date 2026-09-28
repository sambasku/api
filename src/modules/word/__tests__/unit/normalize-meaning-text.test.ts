import { describe, it, expect } from 'vitest';
import {
  isPlaceholderMeaningText,
  normalizeMeaningText,
} from '../../application/utils/normalize-meaning-text';

describe('normalizeMeaningText', () => {
  it('trim + lowercase + collapse whitespace', () => {
    expect(normalizeMeaningText('  Makan  Siang ')).toBe('makan siang');
  });

  it('placeholder detection', () => {
    expect(isPlaceholderMeaningText('-')).toBe(true);
    expect(isPlaceholderMeaningText('  ')).toBe(true);
    expect(isPlaceholderMeaningText('makan')).toBe(false);
  });
});
