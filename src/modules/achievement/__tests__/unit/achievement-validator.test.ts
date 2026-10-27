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

  it('menolak threshold pada registration (supportsThreshold=false)', () => {
    const parsed = achievementCriteriaSchema.safeParse({
      source: 'registration',
      threshold: 5,
      window: {
        from: '2026-01-01T00:00:00+07:00',
        to: '2027-01-01T00:00:00+07:00',
      },
    });
    expect(parsed.success).toBe(false);
  });

  it('menolak filters pada registration (tidak ada filterFields)', () => {
    const parsed = achievementCriteriaSchema.safeParse({
      source: 'registration',
      filters: { entity_type: 'word' },
      window: {
        from: '2026-01-01T00:00:00+07:00',
        to: '2027-01-01T00:00:00+07:00',
      },
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

  it('menerima window dengan offset Z (UTC)', () => {
    const parsed = achievementCriteriaSchema.safeParse({
      source: 'registration',
      window: { from: '2026-01-01T00:00:00Z', to: '2027-01-01T00:00:00Z' },
    });
    expect(parsed.success).toBe(true);
  });

  it('menerima contributions_approved + threshold + filter entity_type', () => {
    const parsed = achievementCriteriaSchema.safeParse({
      source: 'contributions_approved',
      threshold: 10,
      filters: { entity_type: 'word' },
    });
    expect(parsed.success).toBe(true);
  });

  it('menolak filter entity_type asing pada contributions_approved', () => {
    const parsed = achievementCriteriaSchema.safeParse({
      source: 'contributions_approved',
      threshold: 1,
      filters: { entity_type: 'rocket' },
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

describe('badge_url guard (allowlist host)', () => {
  it('menerima jsDelivr + ImageKit', () => {
    expect(
      createAchievementBodySchema.safeParse({
        ...baseBody,
        badge_url: 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/x.png',
      }).success,
    ).toBe(true);
    expect(
      createAchievementBodySchema.safeParse({
        ...baseBody,
        badge_url: 'https://ik.imagekit.io/apinull/achievements/x.png',
      }).success,
    ).toBe(true);
  });
  it('menolak javascript: scheme', () => {
    expect(
      createAchievementBodySchema.safeParse({
        ...baseBody,
        badge_url: 'javascript:alert(1)',
      }).success,
    ).toBe(false);
  });
  it('menolak http (tanpa TLS)', () => {
    expect(
      createAchievementBodySchema.safeParse({
        ...baseBody,
        badge_url: 'http://cdn.jsdelivr.net/x.png',
      }).success,
    ).toBe(false);
  });
  it('menolak host arbitrer + subdomain palsu', () => {
    expect(
      createAchievementBodySchema.safeParse({
        ...baseBody,
        badge_url: 'https://evil.example.com/x.png',
      }).success,
    ).toBe(false);
    expect(
      createAchievementBodySchema.safeParse({
        ...baseBody,
        badge_url: 'https://cdn.jsdelivr.net.evil.com/x.png',
      }).success,
    ).toBe(false);
  });
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
