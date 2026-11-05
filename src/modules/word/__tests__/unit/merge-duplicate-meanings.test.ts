import { describe, expect, it } from 'vitest';
import {
  planSafeMeaningMerges,
  resolveMeaningVotes,
} from '../../application/merge-duplicate-meanings';
import {
  meaningDeduplicationFingerprint,
  meaningDedupeKey,
} from '../../application/utils/meaning-deduplication';

const row = (
  id: string,
  createdAt: number,
  voteCount: number,
  definition: string,
  translation: string,
  wordClassId: string | null = null,
) => ({
  id,
  wordId: 'w1',
  wordClassId,
  definition,
  createdAt,
  voteCount,
  translations: translation
    ? [{ languageId: 'id', translationText: translation }]
    : [],
});

describe('planSafeMeaningMerges', () => {
  it('pemenang paling tua, seri dipecah vote terbanyak', () => {
    const groups = planSafeMeaningMerges([
      row('b', 20, 1, 'Asin', 'asin'),
      row('a', 10, 0, 'asin', 'Asin'),
      row('c', 10, 5, 'ASIN', 'asin'),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.winnerId).toBe('c');
    expect(groups[0]?.loserIds.sort()).toEqual(['a', 'b']);
  });

  it('beda kelas kata tidak digabung', () => {
    const groups = planSafeMeaningMerges([
      row('a', 1, 0, 'makan', 'makan', 'nomina'),
      row('b', 2, 0, 'makan', 'makan', 'verba'),
    ]);
    expect(groups).toEqual([]);
  });

  it('definisi sama padanan beda bukan kelompok aman', () => {
    const groups = planSafeMeaningMerges([
      row('a', 1, 0, 'asin', 'garam'),
      row('b', 2, 0, 'asin', 'asin'),
    ]);
    expect(groups).toEqual([]);
  });
});

describe('resolveMeaningVotes', () => {
  it('user yang memilih pemenang dan pecundang hanya menyisakan vote pemenang', () => {
    const plan = resolveMeaningVotes({
      winnerId: 'win',
      loserIds: ['lose'],
      votes: [
        { userId: 'u', meaningId: 'win', value: 1 },
        { userId: 'u', meaningId: 'lose', value: -1 },
      ],
    });
    expect(plan.moves).toEqual([]);
    expect(plan.deletes).toEqual([{ userId: 'u', meaningId: 'lose' }]);
  });

  it('vote hanya di pecundang dipindah, tidak dijumlahkan', () => {
    const plan = resolveMeaningVotes({
      winnerId: 'win',
      loserIds: ['l1', 'l2'],
      votes: [
        { userId: 'u', meaningId: 'l1', value: 1 },
        { userId: 'u', meaningId: 'l2', value: 1 },
      ],
    });
    expect(plan.moves).toEqual([{ userId: 'u', fromMeaningId: 'l1', toMeaningId: 'win' }]);
    expect(plan.deletes).toEqual([{ userId: 'u', meaningId: 'l2' }]);
  });
});

describe('meaningDedupeKey', () => {
  it('null bila tidak ada teks identitas', () => {
    expect(
      meaningDedupeKey({ definition: '-', translations: [], wordClassId: 'kelas' }),
    ).toBeNull();
  });

  it('beda kelas menghasilkan kunci berbeda', () => {
    const a = meaningDeduplicationFingerprint({
      definition: 'makan',
      translation: 'makan',
      wordClassId: 'nomina',
    });
    const b = meaningDeduplicationFingerprint({
      definition: 'makan',
      translation: 'makan',
      wordClassId: 'verba',
    });
    expect(a).not.toBe(b);
  });
});
