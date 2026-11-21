import { describe, expect, it } from 'vitest';
import { filterMeaningsForPublicDetail } from '../../application/utils/resolve-publication';

const meanings = [
  { id: '01VERIFIEDMEANING00000001', isVerified: true },
  { id: '01PENDINGMEANING000000002', isVerified: false },
  { id: '01PENDINGMEANING000000003', isVerified: false },
];

describe('filterMeaningsForPublicDetail', () => {
  it('default publik: hanya verified', () => {
    expect(filterMeaningsForPublicDetail(meanings)).toEqual([meanings[0]]);
  });

  it('focusMeaningId: verified + makna fokus', () => {
    expect(
      filterMeaningsForPublicDetail(meanings, {
        focusMeaningId: '01PENDINGMEANING000000002',
      }),
    ).toEqual([meanings[0], meanings[1]]);
  });

  it('includeUnverified: semua', () => {
    expect(
      filterMeaningsForPublicDetail(meanings, { includeUnverified: true }),
    ).toEqual(meanings);
  });

  it('verifikator: semua', () => {
    expect(
      filterMeaningsForPublicDetail(meanings, { viewerIsVerifier: true }),
    ).toEqual(meanings);
  });
});
