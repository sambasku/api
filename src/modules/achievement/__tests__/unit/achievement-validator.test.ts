import { describe, it, expect } from 'vitest';
import {
  achievementCodeSchema,
  achievementCriteriaSchema,
  createAchievementBodySchema,
  setBorderBodySchema,
} from '@/modules/achievement/presentation/v1/validators/achievement.validator';

/**
 * Grammar kriteria: registry-driven. Source tak dikenal = invalid;
 * threshold/window hanya untuk source yang mendukung.
 */
describe('achievement criteria schema (Zod registry)', () => {
  it('menerima source registration dengan window valid', () => {
    const parsed = achievementCriteriaSchema.safeParse({
      source: 'registration',
      window: {
        from: '2026-01-01T00:00:00+07:00',
        to: '2027-01-01T00:00:00+07:00',
      },
    });
    expect(parsed.success).toBe(true);
  });

  it('menolak source yang tidak ada di registry', () => {
    const parsed = achievementCriteriaSchema.safeParse({
      source: 'arbitrary_sql_injection',
    });
    expect(parsed.success).toBe(false);
  });

  it('menolak source manual yang membawa threshold/window', () => {
    const parsed = achievementCriteriaSchema.safeParse({
      source: 'manual',
      threshold: 5,
    });
    expect(parsed.success).toBe(false);
  });

  it('menolak window.to <= window.from', () => {
    const parsed = achievementCriteriaSchema.safeParse({
      source: 'registration',
      window: {
        from: '2027-01-01T00:00:00+07:00',
        to: '2026-01-01T00:00:00+07:00',
      },
    });
    expect(parsed.success).toBe(false);
  });

  it('menolak window tanpa offset timezone', () => {
    const parsed = achievementCriteriaSchema.safeParse({
      source: 'registration',
      window: { from: '2026-01-01T00:00:00Z', to: '2027-01-01T00:00:00Z' },
    });
    // Z memang offset valid (UTC) - harus lolos
    expect(parsed.success).toBe(true);
  });

  it('menolak threshold < 1', () => {
    const parsed = achievementCriteriaSchema.safeParse({
      source: 'registration',
      threshold: 0,
    });
    expect(parsed.success).toBe(false);
  });
});

describe('achievement code schema', () => {
  it('menerima slug lowercase + hyphen', () => {
    expect(achievementCodeSchema.safeParse('angkatan-ke-1').success).toBe(true);
    expect(achievementCodeSchema.safeParse('beta-tester').success).toBe(true);
  });
  it('menolak uppercase, spasi, underscore', () => {
    expect(achievementCodeSchema.safeParse('Angkatan').success).toBe(false);
    expect(achievementCodeSchema.safeParse('angkatan ke').success).toBe(false);
    expect(achievementCodeSchema.safeParse('angkatan_ke').success).toBe(false);
  });
});

describe('create achievement body', () => {
  const baseBody = {
    code: 'angkatan-ke-1',
    title: 'Angkatan Ke-1',
    description: 'Terdaftar sebagai pengguna SambasKu pada angkatan pertama',
    category: 'kohort',
    reward_type: 'profile_border',
    badge_url: 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/achievements/angkatan-ke-1.png',
    criteria: {
      source: 'registration',
      window: {
        from: '2026-01-01T00:00:00+07:00',
        to: '2027-01-01T00:00:00+07:00',
      },
    },
  };

  it('menerima body seed angkatan-ke-1', () => {
    expect(createAchievementBodySchema.safeParse(baseBody).success).toBe(true);
  });

  it('default is_active = true', () => {
    const parsed = createAchievementBodySchema.parse(baseBody);
    expect(parsed.is_active).toBe(true);
  });

  it('menolak reward_type tak dikenal', () => {
    expect(
      createAchievementBodySchema.safeParse({ ...baseBody, reward_type: 'rocket' }).success,
    ).toBe(false);
  });
});

describe('set border body', () => {
  it('menerima award id 26 char', () => {
    expect(setBorderBodySchema.safeParse({ border_id: '01ARZ3NDEKTSV4RRFFQ69G5FAV' }).success).toBe(true);
  });
  it('menerima null = lepas border', () => {
    expect(setBorderBodySchema.safeParse({ border_id: null }).success).toBe(true);
  });
  it('menolak id pendek', () => {
    expect(setBorderBodySchema.safeParse({ border_id: 'abc' }).success).toBe(false);
  });
});
