import { describe, expect, it } from 'vitest';
import { countLeaderboardTopRepeats } from '../../domain/leaderboard-top-repeat';

describe('countLeaderboardTopRepeats', () => {
  const ranks = [
    { rank: 1, weekStartedAt: new Date('2026-09-28T00:00:00+07:00') },
    { rank: 1, weekStartedAt: new Date('2026-10-05T00:00:00+07:00') },
    { rank: 2, weekStartedAt: new Date('2026-10-12T00:00:00+07:00') },
    { rank: 5, weekStartedAt: new Date('2026-10-19T00:00:00+07:00') },
    { rank: 15, weekStartedAt: new Date('2026-10-26T00:00:00+07:00') },
  ];

  it('counts juara (1-1) with repeats', () => {
    expect(
      countLeaderboardTopRepeats(ranks, {
        source: 'leaderboard_top',
        filters: { rank_min: '1', rank_max: '1' },
      }),
    ).toBe(2);
  });

  it('counts tiga besar (2-3) without juara', () => {
    expect(
      countLeaderboardTopRepeats(ranks, {
        source: 'leaderboard_top',
        filters: { rank_min: '2', rank_max: '3' },
      }),
    ).toBe(1);
  });

  it('counts sepuluh (4-10)', () => {
    expect(
      countLeaderboardTopRepeats(ranks, {
        source: 'leaderboard_top',
        filters: { rank_min: '4', rank_max: '10' },
      }),
    ).toBe(1);
  });

  it('counts papan (11-30)', () => {
    expect(
      countLeaderboardTopRepeats(ranks, {
        source: 'leaderboard_top',
        filters: { rank_min: '11', rank_max: '30' },
      }),
    ).toBe(1);
  });

  it('returns 0 for other sources', () => {
    expect(
      countLeaderboardTopRepeats(ranks, {
        source: 'registration',
      }),
    ).toBe(0);
  });
});
