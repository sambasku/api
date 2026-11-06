import { describe, expect, it } from 'vitest';
import { planLemmaCaseMerges } from '../../application/plan-lemma-case-merge';

describe('planLemmaCaseMerges', () => {
  it('menggabungkan Jelas dan jelas, penunggu yang lebih dulu', () => {
    const groups = planLemmaCaseMerges([
      { id: 'b', languageId: 'sbs', lemma: 'jelas', createdAt: 20 },
      { id: 'a', languageId: 'sbs', lemma: ' Jelas ', createdAt: 10 },
      { id: 'c', languageId: 'id', lemma: 'Jelas', createdAt: 1 },
    ]);

    expect(groups).toEqual([
      { languageId: 'sbs', lemma: 'jelas', keepId: 'a', mergeIds: ['b'] },
    ]);
  });

  it('seri createdAt memakai id terkecil sebagai penunggu', () => {
    const groups = planLemmaCaseMerges([
      { id: 'b', languageId: 'sbs', lemma: 'Jelas', createdAt: 5 },
      { id: 'a', languageId: 'sbs', lemma: 'jelas', createdAt: 5 },
    ]);
    expect(groups[0]).toMatchObject({ keepId: 'a', mergeIds: ['b'] });
  });
});
