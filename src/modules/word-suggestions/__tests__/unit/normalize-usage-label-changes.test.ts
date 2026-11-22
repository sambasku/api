import { describe, expect, it } from 'vitest';
import { normalizeUsageLabelChanges } from '../../application/utils/normalize-usage-label-changes';
import { BadRequestError } from '@/shared/errors/app-error';

describe('normalizeUsageLabelChanges', () => {
  it('memfilter add/remove no-op', () => {
    const next = normalizeUsageLabelChanges(['informal'], {
      usageLabelsToAdd: ['informal', 'kasar'],
      usageLabelsToRemove: ['tabu'],
    });
    expect(next.usageLabelsToAdd).toEqual(['kasar']);
    expect(next.usageLabelsToRemove).toBeUndefined();
  });

  it('menolak tanpa perubahan nyata', () => {
    expect(() =>
      normalizeUsageLabelChanges(['kasar'], {
        usageLabelsToAdd: ['kasar'],
      }),
    ).toThrow(BadRequestError);
  });

  it('menolak halus + kasar', () => {
    expect(() =>
      normalizeUsageLabelChanges([], {
        usageLabelsToAdd: ['halus', 'kasar'],
      }),
    ).toThrow(BadRequestError);
  });
});