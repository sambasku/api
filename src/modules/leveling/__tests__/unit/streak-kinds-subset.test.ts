import { describe, expect, it } from 'vitest';
import { ACTIVITY_EVENT_KINDS } from '@/modules/activity/domain/entities/activity-event.entity';
import { STREAK_ACTIVITY_KINDS } from '../../domain/streak';

describe('STREAK_ACTIVITY_KINDS ⊆ ACTIVITY_EVENT_KINDS', () => {
  it('setiap kind streak ada di katalog activity', () => {
    const allowed = new Set<string>(ACTIVITY_EVENT_KINDS);
    for (const kind of STREAK_ACTIVITY_KINDS) {
      expect(allowed.has(kind), `kind streak tidak dikenal: ${kind}`).toBe(true);
    }
  });
});
