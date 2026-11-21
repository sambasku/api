import { describe, it, expect } from 'vitest';
import {
  effectiveAggregateThreshold,
  findAchievementSource,
  parseRoleInFilter,
} from '@/modules/achievement/domain/achievement-registry';

describe('achievement registry - dual mode (B2)', () => {
  it('registration = user_match tanpa threshold', () => {
    const src = findAchievementSource('registration');
    expect(src?.kind).toBe('user_match');
    expect(src?.supportsThreshold).toBe(false);
    expect(src?.buildMatch).toBeTypeOf('function');
  });

  it('user_role = user_match dengan filter role_in', () => {
    const src = findAchievementSource('user_role');
    expect(src?.kind).toBe('user_match');
    expect(src?.supportsThreshold).toBe(false);
    expect(src?.supportsWindow).toBe(false);
    expect(src?.filterFields.map((f) => f.key)).toContain('role_in');
    expect(src?.buildMatch).toBeTypeOf('function');
    const match = src!.buildMatch!({
      source: 'user_role',
      filters: { role_in: 'reviewer,admin,root' },
    });
    expect(match).toBeTruthy();
    expect(
      src!.buildMatch!({ source: 'user_role', filters: { role_in: 'bukan-role' } }),
    ).toBeTruthy();
  });

  it('parseRoleInFilter: pisah koma + dedupe + skip invalid', () => {
    expect(parseRoleInFilter('reviewer,admin,root')).toEqual(['reviewer', 'admin', 'root']);
    expect(parseRoleInFilter('admin, admin, contributor')).toEqual(['admin', 'contributor']);
    expect(parseRoleInFilter('bukan,role')).toEqual([]);
    expect(parseRoleInFilter(undefined)).toEqual([]);
  });

  it('contributions_approved = aggregate dengan filter entity_type', () => {
    const src = findAchievementSource('contributions_approved');
    expect(src?.kind).toBe('aggregate');
    expect(src?.aggregateFact).toBe('contributions');
    expect(src?.supportsThreshold).toBe(true);
    expect(src?.filterFields.map((f) => f.key)).toContain('entity_type');
    expect(src?.buildAggregateFilters).toBeTypeOf('function');
    const filters = src!.buildAggregateFilters!({
      source: 'contributions_approved',
      threshold: 10,
      filters: { entity_type: 'word' },
    });
    expect(filters.length).toBeGreaterThanOrEqual(1);
  });

  it('G3 sources terdaftar sebagai aggregate', () => {
    for (const source of [
      'verifications_done',
      'comments_published',
      'discussions_created',
      'discussion_replies_published',
      'articles_published',
    ]) {
      const src = findAchievementSource(source);
      expect(src?.kind).toBe('aggregate');
      expect(src?.supportsThreshold).toBe(true);
      expect(src?.aggregateFact).toBeTruthy();
    }
  });

  it('effectiveAggregateThreshold: null → 1', () => {
    expect(effectiveAggregateThreshold({ source: 'contributions_approved' })).toBe(1);
    expect(
      effectiveAggregateThreshold({ source: 'contributions_approved', threshold: 50 }),
    ).toBe(50);
  });
});
