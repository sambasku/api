import { describe, expect, it } from 'vitest';
import {
  IMPORT_POINT_FACTOR,
  LEVEL_THRESHOLDS,
  MAX_LEVEL,
  POINT_WEIGHTS,
  SCARCITY_MULT_COMMON,
  SCARCITY_MULT_RARE,
  SCARCITY_MULT_UNCOMMON,
  buildLeveling,
  levelForPoints,
  nextLevelPoints,
  pointsForContributionEntity,
  pointsForVoteReceived,
  scarcityMultiplier,
  titleCodeForLevel,
} from '../../domain/leveling';

describe('levelForPoints', () => {
  it('batas tiap pita', () => {
    expect(levelForPoints(0)).toBe(1);
    expect(levelForPoints(19)).toBe(1);
    expect(levelForPoints(20)).toBe(2);
    expect(levelForPoints(21)).toBe(2);
    expect(levelForPoints(599)).toBe(4);
    expect(levelForPoints(600)).toBe(5);
    expect(levelForPoints(1399)).toBe(5);
    expect(levelForPoints(1400)).toBe(6);
    expect(levelForPoints(2250)).toBe(6); // 150 kata bare
    expect(levelForPoints(11999)).toBe(9);
    expect(levelForPoints(12000)).toBe(10);
    expect(levelForPoints(89999)).toBe(14);
    expect(levelForPoints(90000)).toBe(15);
    expect(levelForPoints(999999)).toBe(15);
  });

  it('panjang threshold = max level 15', () => {
    expect(LEVEL_THRESHOLDS.length).toBe(15);
    expect(MAX_LEVEL).toBe(15);
  });
});

describe('nextLevelPoints', () => {
  it('null di L15', () => {
    expect(nextLevelPoints(90000)).toBeNull();
    expect(nextLevelPoints(0)).toBe(20);
    expect(nextLevelPoints(2250)).toBe(2800);
  });
});

describe('titleCodeForLevel', () => {
  it('gelar generik', () => {
    expect(titleCodeForLevel(1)).toBe('peninjau');
    expect(titleCodeForLevel(6)).toBe('penjaga-jejak');
    expect(titleCodeForLevel(10)).toBe('sesepuh');
    expect(titleCodeForLevel(15)).toBe('legenda');
  });
});

describe('pointsForContributionEntity', () => {
  it('bobot penuh vs impor 50%', () => {
    expect(pointsForContributionEntity('word', false)).toBe(15);
    expect(pointsForContributionEntity('word', true)).toBe(15 * IMPORT_POINT_FACTOR);
    expect(pointsForContributionEntity('meaning', true)).toBe(6 * IMPORT_POINT_FACTOR);
    expect(POINT_WEIGHTS.pantun).toBe(3);
    expect(POINT_WEIGHTS.vote_received).toBe(1);
  });

  it('kelangkaan setelah impor', () => {
    expect(pointsForContributionEntity('word', false, 50)).toBe(15 * SCARCITY_MULT_RARE);
    expect(pointsForContributionEntity('word', true, 50)).toBe(
      15 * IMPORT_POINT_FACTOR * SCARCITY_MULT_RARE,
    );
    expect(pointsForContributionEntity('word', false, 200)).toBe(
      15 * SCARCITY_MULT_UNCOMMON,
    );
    expect(pointsForContributionEntity('word', false, 5000)).toBe(
      15 * SCARCITY_MULT_COMMON,
    );
  });
});

describe('scarcityMultiplier / vote_received', () => {
  it('batas count bahasa', () => {
    expect(scarcityMultiplier(0)).toBe(1.5);
    expect(scarcityMultiplier(99)).toBe(1.5);
    expect(scarcityMultiplier(100)).toBe(1.25);
    expect(scarcityMultiplier(499)).toBe(1.25);
    expect(scarcityMultiplier(500)).toBe(1.0);
  });

  it('vote diterima = count × 1', () => {
    expect(pointsForVoteReceived(3)).toBe(3);
    expect(pointsForVoteReceived(-1)).toBe(0);
  });
});

describe('buildLeveling', () => {
  it('mengisi wire', () => {
    const l = buildLeveling({
      points: 2250,
      exploration: 150,
      accuracy: 40,
      depth: 20,
      streakDays: 6,
    });
    expect(l.level).toBe(6);
    expect(l.nextLevelPoints).toBe(2800);
    expect(l.titleCode).toBe('penjaga-jejak');
    expect(l.streakDays).toBe(6);
  });
});
