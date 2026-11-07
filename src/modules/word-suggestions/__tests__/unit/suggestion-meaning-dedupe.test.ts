import { describe, expect, it } from 'vitest';
import { ConflictError } from '@/shared/errors/app-error';
import {
  meaningDeduplicationFingerprint,
  type ActiveMeaningIdentity,
} from '@/modules/word/application/utils/meaning-deduplication';
import { planMeaningApplies } from '../../application/utils/suggestion-meaning-dedupe';

function row(
  partial: Omit<ActiveMeaningIdentity, 'fingerprint'>,
): ActiveMeaningIdentity {
  return {
    ...partial,
    fingerprint: meaningDeduplicationFingerprint({
      definition: partial.definition,
      translations: partial.translations,
      wordClassId: partial.wordClassId,
    }),
  };
}

describe('planMeaningApplies', () => {
  it('add yang sudah ada ditandai skip, tidak melempar', () => {
    const plan = planMeaningApplies(
      [row({ id: 'm1', wordClassId: null, definition: 'Asin', translations: [{ languageId: 'id', translationText: 'asin' }] })],
      [
      {
        action: 'add',
        definition: 'asin',
        translations: [{ languageId: 'id', translationText: 'Asin' }],
      },
    ]);
    expect(plan.skipAddIndexes.has(0)).toBe(true);
    expect(plan.skipped[0]?.meaningId).toBe('m1');
  });

  it('update yang menabrak makna lain melempar 409', () => {
    const asin = row({
      id: 'm1',
      wordClassId: null,
      definition: 'Asin',
      translations: [{ languageId: 'id', translationText: 'asin' }],
    });
    const gurih = row({
      id: 'm2',
      wordClassId: null,
      definition: 'Gurih',
      translations: [{ languageId: 'id', translationText: 'gurih' }],
    });
    expect(() =>
      planMeaningApplies([asin, gurih], [
        {
          action: 'update',
          meaningId: 'm2',
          definition: 'asin',
          translations: [{ languageId: 'id', translationText: 'asin' }],
        },
      ]),
    ).toThrow(ConflictError);
  });
});
