import { describe, expect, it } from 'vitest';
import {
  mapDuplicateMeaningIndexes,
  meaningDeduplicationFingerprint,
} from '../../application/utils/meaning-deduplication';

describe('meaningDeduplicationFingerprint', () => {
  it('case-insensitive terhadap definisi dan padanan', () => {
    const fp1 = meaningDeduplicationFingerprint({
      definition: 'Rasa seperti garam',
      translation: 'Asin',
      isHaveDefinition: true,
      isHaveTranslation: true,
    });
    const fp2 = meaningDeduplicationFingerprint({
      definition: 'rasa seperti garam',
      translation: 'asin',
      isHaveDefinition: true,
      isHaveTranslation: true,
    });
    expect(fp1).toBe(fp2);
  });

  it('menganggap makna dengan terjemahan sama dan tanpa definisi sebagai duplikat', () => {
    const fp1 = meaningDeduplicationFingerprint({
      definition: '-',
      translation: 'Asin',
      isHaveDefinition: false,
      isHaveTranslation: true,
    });
    const fp2 = meaningDeduplicationFingerprint({
      definition: '',
      translation: 'asin',
      isHaveDefinition: false,
      isHaveTranslation: true,
    });
    expect(fp1).toBe(fp2);
  });

  it('membedakan makna dengan definisi berbeda walaupun padanannya sama', () => {
    const fp1 = meaningDeduplicationFingerprint({
      definition: 'Rasa seperti garam dapur',
      translation: 'asin',
      isHaveDefinition: true,
      isHaveTranslation: true,
    });
    const fp2 = meaningDeduplicationFingerprint({
      definition: 'Mengandung kadar garam tinggi',
      translation: 'asin',
      isHaveDefinition: true,
      isHaveTranslation: true,
    });
    expect(fp1).not.toBe(fp2);
  });

  it('padanan multi-bahasa dibandingkan sebagai himpunan utuh', () => {
    const base = {
      definition: 'rasa asin',
      isHaveDefinition: true,
      isHaveTranslation: true,
    };
    const fp1 = meaningDeduplicationFingerprint({
      ...base,
      translations: [
        { languageId: 'id', translationText: 'Asin' },
        { languageId: 'en', translationText: 'Salty' },
      ],
    });
    const fp2 = meaningDeduplicationFingerprint({
      ...base,
      translations: [
        { languageId: 'en', translationText: 'salty' },
        { languageId: 'id', translationText: 'asin' },
      ],
    });
    const fp3 = meaningDeduplicationFingerprint({
      ...base,
      translations: [{ languageId: 'id', translationText: 'asin' }],
    });
    expect(fp1).toBe(fp2);
    expect(fp1).not.toBe(fp3);
  });
});

describe('mapDuplicateMeaningIndexes', () => {
  it('menandai duplikat beda kapital + sama persis, indeks pertama dipertahankan', () => {
    const { firstIndex, isDuplicate } = mapDuplicateMeaningIndexes([
      { definition: 'Asin', translations: [{ languageId: 'id', translationText: 'asin' }] },
      { definition: 'asin', translations: [{ languageId: 'id', translationText: 'Asin' }] },
      { definition: 'asin', translations: [{ languageId: 'id', translationText: 'asin' }] },
      { definition: 'Gurih', translations: [{ languageId: 'id', translationText: 'gurih' }] },
    ]);
    expect(firstIndex).toEqual([0, 0, 0, 3]);
    expect(isDuplicate).toEqual([false, true, true, false]);
  });

  it('padanan berbeda → bukan duplikat', () => {
    const { isDuplicate } = mapDuplicateMeaningIndexes([
      { definition: 'asin', translations: [{ languageId: 'id', translationText: 'asin' }] },
      { definition: 'asin', translations: [{ languageId: 'id', translationText: 'garam' }] },
    ]);
    expect(isDuplicate).toEqual([false, false]);
  });
});
