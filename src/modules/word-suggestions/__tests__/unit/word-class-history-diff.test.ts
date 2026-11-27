import { describe, expect, it } from 'vitest';
import {
  formatWordClassDiff,
  wordClassPairsFromSuggestion,
} from '../../domain/word-class-history-diff';

describe('formatWordClassDiff', () => {
  it('menyusun sebelum dan sesudah', () => {
    expect(
      formatWordClassDiff([
        { oldLabel: 'Nomina', newLabel: 'Verba' },
      ]),
    ).toEqual({ displayOld: 'Nomina', displayNew: 'Verba' });
  });

  it('kosong kalau kelas tidak berubah', () => {
    expect(formatWordClassDiff([{ oldLabel: 'Nomina', newLabel: 'Nomina' }])).toBeNull();
  });
});

describe('wordClassPairsFromSuggestion', () => {
  it('mengambil kelas lama dari baseline dan kelas baru dari usulan', () => {
    expect(
      wordClassPairsFromSuggestion(
        {
          meanings: [
            { action: 'update', meaningId: 'm1', wordClassId: 'new' },
            { action: 'update', meaningId: 'm2', wordClassId: 'same' },
          ],
        },
        {
          meanings: [
            { id: 'm1', wordClassId: 'old' },
            { id: 'm2', wordClassId: 'same' },
          ],
        },
      ),
    ).toEqual([{ oldId: 'old', newId: 'new' }]);
  });
});
