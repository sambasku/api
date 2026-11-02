import { describe, it, expect } from 'vitest';
import { normalizeDiscussionListSort } from '../../domain/entities/discussion.entity';

describe('normalizeDiscussionListSort', () => {
  it('latest / default → created desc', () => {
    expect(normalizeDiscussionListSort(undefined, undefined)).toEqual({
      sort: 'created',
      order: 'desc',
    });
    expect(normalizeDiscussionListSort('latest', 'asc')).toEqual({
      sort: 'created',
      order: 'desc',
    });
  });

  it('popular → votes desc (abaikan order)', () => {
    expect(normalizeDiscussionListSort('popular', 'asc')).toEqual({
      sort: 'votes',
      order: 'desc',
    });
  });

  it('kunci baru menghormati order', () => {
    expect(normalizeDiscussionListSort('activity', 'asc')).toEqual({
      sort: 'activity',
      order: 'asc',
    });
    expect(normalizeDiscussionListSort('replies', undefined)).toEqual({
      sort: 'replies',
      order: 'desc',
    });
    expect(normalizeDiscussionListSort('votes', 'asc')).toEqual({
      sort: 'votes',
      order: 'asc',
    });
  });
});
