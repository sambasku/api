import { describe, expect, it } from 'vitest';
import { NotFoundError, ValidationError } from '@/shared/errors/app-error';
import {
  attachCommentRepliesTwoLevel,
  nestFlatCommentsTwoLevel,
  resolveCommentParentId,
} from '../comment-threading';

describe('comment-threading', () => {
  describe('resolveCommentParentId', () => {
    it('returns null when rawParentId is empty or omitted', async () => {
      const res = await resolveCommentParentId({
        rawParentId: null,
        hostId: 'host-1',
        findParent: async () => null,
      });
      expect(res).toBeNull();
    });

    it('returns parent id when parent is top-level, published, and same host', async () => {
      const res = await resolveCommentParentId({
        rawParentId: 'parent-1',
        hostId: 'host-1',
        findParent: async () => ({
          id: 'parent-1',
          hostId: 'host-1',
          parentId: null,
          status: 'published',
        }),
      });
      expect(res).toBe('parent-1');
    });

    it('rejects reply-to-reply (max 1 level)', async () => {
      await expect(
        resolveCommentParentId({
          rawParentId: 'child-1',
          hostId: 'host-1',
          findParent: async () => ({
            id: 'child-1',
            hostId: 'host-1',
            parentId: 'parent-1',
            status: 'published',
          }),
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejects parent from another host or non-published parent', async () => {
      await expect(
        resolveCommentParentId({
          rawParentId: 'parent-2',
          hostId: 'host-1',
          findParent: async () => ({
            id: 'parent-2',
            hostId: 'host-2',
            parentId: null,
            status: 'published',
          }),
        }),
      ).rejects.toBeInstanceOf(NotFoundError);

      await expect(
        resolveCommentParentId({
          rawParentId: 'parent-3',
          hostId: 'host-1',
          findParent: async () => ({
            id: 'parent-3',
            hostId: 'host-1',
            parentId: null,
            status: 'deleted_by_author',
          }),
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('attachCommentRepliesTwoLevel', () => {
    it('attaches replies sorted chronologically ascending while keeping top order', () => {
      const t1 = new Date('2026-01-01T10:00:00Z');
      const t2 = new Date('2026-01-02T10:00:00Z');
      const r1 = new Date('2026-01-02T11:00:00Z');
      const r2 = new Date('2026-01-02T12:00:00Z');

      const tops: Array<{ id: string; parentId: string | null; createdAt: Date }> = [
        { id: 'c2', parentId: null, createdAt: t2 },
        { id: 'c1', parentId: null, createdAt: t1 },
      ];
      const replies = [
        { id: 'r2', parentId: 'c2', createdAt: r2 },
        { id: 'r1', parentId: 'c2', createdAt: r1 },
        { id: 'orphan', parentId: 'missing', createdAt: r1 },
      ];

      const result = attachCommentRepliesTwoLevel(tops, replies);
      expect(result.map((c) => c.id)).toEqual(['c2', 'c1']);
      expect(result[0].replies.map((r) => r.id)).toEqual(['r1', 'r2']);
      expect(result[1].replies).toEqual([]);
    });
  });

  describe('nestFlatCommentsTwoLevel', () => {
    it('nests flat rows with newest-first tops and chronological replies', () => {
      const flat = [
        { id: 'c1', parentId: null, createdAt: new Date('2026-01-01T10:00:00Z') },
        { id: 'c2', parentId: null, createdAt: new Date('2026-01-02T10:00:00Z') },
        { id: 'r2', parentId: 'c1', createdAt: new Date('2026-01-01T12:00:00Z') },
        { id: 'r1', parentId: 'c1', createdAt: new Date('2026-01-01T11:00:00Z') },
        { id: 'orphan', parentId: 'c999', createdAt: new Date('2026-01-01T13:00:00Z') },
      ];

      const nested = nestFlatCommentsTwoLevel(flat);
      expect(nested.map((c) => c.id)).toEqual(['c2', 'c1']);
      expect(nested[1].replies.map((r) => r.id)).toEqual(['r1', 'r2']);
    });
  });
});
