import { describe, it, expect } from 'vitest';
import {
  isPlaceholderMeaningText,
  normalizeMeaningText,
} from '../../application/utils/normalize-meaning-text';

describe('normalizeMeaningText', () => {
  it('menghapus karakter format sebelum trim', () => {
    expect(normalizeMeaningText(`asin${String.fromCharCode(0x200b)}`)).toBe('asin');
    expect(normalizeMeaningText('  Makan  Siang ')).toBe('makan siang');
  });

  it('placeholder detection', () => {
    expect(isPlaceholderMeaningText('-')).toBe(true);
    expect(isPlaceholderMeaningText('  ')).toBe(true);
    expect(isPlaceholderMeaningText('makan')).toBe(false);
  });
});
