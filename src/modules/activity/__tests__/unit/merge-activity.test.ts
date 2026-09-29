import { describe, expect, it } from 'vitest';
import type { ActivityItem } from '../../domain/entities/activity-item.entity';
import { mergeActivityFeed } from '../../domain/merge-activity';

function item(
  partial: Pick<ActivityItem, 'kind' | 'id'> & Partial<ActivityItem>,
): ActivityItem {
  return {
    createdAt: partial.createdAt ?? new Date('2026-09-28T12:00:00.000Z'),
    actor: partial.actor ?? {
      username: 'u',
      displayName: 'U',
      avatarUrl: null,
    },
    body: partial.body ?? `body-${partial.id}`,
    subtitle: partial.subtitle ?? null,
    target: partial.target ?? null,
    ...partial,
  };
}

describe('mergeActivityFeed', () => {
  it('urut terbaru dulu', () => {
    const merged = mergeActivityFeed([
      item({
        kind: 'comment',
        id: 'comment:a',
        createdAt: new Date('2026-09-28T10:00:00.000Z'),
      }),
      item({
        kind: 'vote',
        id: 'vote:b',
        createdAt: new Date('2026-09-28T12:00:00.000Z'),
      }),
      item({
        kind: 'discussion',
        id: 'discussion:c',
        createdAt: new Date('2026-09-28T11:00:00.000Z'),
      }),
    ]);
    expect(merged.map((e) => e.id)).toEqual(['vote:b', 'discussion:c', 'comment:a']);
  });

  it('dedupe by id', () => {
    const merged = mergeActivityFeed([
      item({ kind: 'vote', id: 'vote:1', createdAt: new Date('2026-09-28T12:00:00.000Z') }),
      item({ kind: 'vote', id: 'vote:1', createdAt: new Date('2026-09-28T11:00:00.000Z') }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].createdAt.toISOString()).toBe('2026-09-28T12:00:00.000Z');
  });

  it('cap per kind lalu limit global', () => {
    const votes = Array.from({ length: 8 }, (_, i) =>
      item({
        kind: 'vote',
        id: `vote:v${i}`,
        createdAt: new Date(`2026-09-28T${String(20 - i).padStart(2, '0')}:00:00.000Z`),
      }),
    );
    const comments = Array.from({ length: 3 }, (_, i) =>
      item({
        kind: 'comment',
        id: `comment:c${i}`,
        createdAt: new Date(`2026-09-28T${String(15 - i).padStart(2, '0')}:00:00.000Z`),
      }),
    );
    const merged = mergeActivityFeed([...votes, ...comments], {
      perKindCap: 4,
      limit: 20,
    });
    expect(merged.filter((e) => e.kind === 'vote')).toHaveLength(4);
    expect(merged.filter((e) => e.kind === 'comment')).toHaveLength(3);
    expect(merged).toHaveLength(7);
    expect(merged[0].id).toBe('vote:v0');
  });

  it('before memotong item yang tidak lebih lama dari cursor', () => {
    const merged = mergeActivityFeed(
      [
        item({
          kind: 'vote',
          id: 'vote:new',
          createdAt: new Date('2026-09-28T12:00:00.000Z'),
        }),
        item({
          kind: 'comment',
          id: 'comment:old',
          createdAt: new Date('2026-09-28T10:00:00.000Z'),
        }),
      ],
      {
        before: {
          createdAt: new Date('2026-09-28T11:00:00.000Z'),
          id: 'vote:mid',
        },
      },
    );
    expect(merged.map((e) => e.id)).toEqual(['comment:old']);
  });
});
