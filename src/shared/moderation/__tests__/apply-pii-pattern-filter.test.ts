import { describe, expect, it } from 'vitest';
import { applyPiiPatternFilter } from '../apply-pii-pattern-filter';

describe('applyPiiPatternFilter', () => {
  it('censors email', () => {
    expect(applyPiiPatternFilter('hubungi a@b.co ya')).toBe('hubungi *** ya');
    expect(applyPiiPatternFilter('Email: Budi.Test+1@Example.COM')).toBe(
      'Email: ***',
    );
  });

  it('does not censor @username mention', () => {
    expect(applyPiiPatternFilter('hai @budi apa kabar')).toBe(
      'hai @budi apa kabar',
    );
  });

  it('censors Indonesian phone numbers', () => {
    expect(applyPiiPatternFilter('WA 081234567890')).toBe('WA ***');
    expect(applyPiiPatternFilter('tel +62 812-3456-7890')).toBe('tel ***');
    expect(applyPiiPatternFilter('kontak 6281234567890')).toBe('kontak ***');
  });

  it('censors wa.me links', () => {
    expect(applyPiiPatternFilter('klik https://wa.me/6281234567890')).toBe(
      'klik ***',
    );
    expect(applyPiiPatternFilter('wa.me/6281234567890 sekarang')).toBe(
      '*** sekarang',
    );
  });

  it('leaves clean text alone', () => {
    expect(applyPiiPatternFilter('Halo warga Sambas')).toBe(
      'Halo warga Sambas',
    );
  });
});
