import { describe, it, expect, vi } from 'vitest';
import { ListPublishedDiscussionsUseCase } from '../../application/use-cases/list-published-discussions.use-case';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';
import type { Discussion } from '../../domain/entities/discussion.entity';
import type { VoteRepository } from '@/modules/vote/domain/repositories/vote.repository';

const D1 = '01JDDISC000000000000000001';
const D2 = '01JDDISC000000000000000002';

function makeHelp(id: string, overrides: Partial<Discussion> = {}): Discussion {
  return {
    id,
    userId: '01JDUSER000000000000000001',
    username: 'peminta',
    displayName: 'peminta',
    avatarUrl: null,
    userRole: null,
    body: 'Apa arti ini?',
    linkUrl: null,
    images: [],
    audio: null,
    status: 'published',
    rejectionNote: null,
    reviewedBy: null,
    reviewedAt: null,
    pinnedReplyId: null,
    createdAt: new Date('2026-09-24T00:00:00Z'),
    updatedAt: null,
    ...overrides,
  };
}

describe('ListPublishedDiscussionsUseCase', () => {
  it('melampirkan upvotes + reply_count dari batch (bukan N+1)', async () => {
    const items = [makeHelp(D1), makeHelp(D2)];
    const repo = {
      list: vi.fn().mockResolvedValue({
        items,
        nextCursor: null,
        hasMore: false,
      }),
      countPublishedRepliesByDiscussionIds: vi.fn().mockResolvedValue(
        new Map([
          [D1, 3],
          [D2, 0],
        ]),
      ),
    } as unknown as DiscussionRepository;

    const voteRepo = {
      countMany: vi.fn().mockResolvedValue(
        new Map([
          [`discussion:${D1}`, { upvotes: 5, downvotes: 0 }],
          [`discussion:${D2}`, { upvotes: 1, downvotes: 0 }],
        ]),
      ),
    } as unknown as VoteRepository;

    const uc = new ListPublishedDiscussionsUseCase(repo, voteRepo);
    const page = await uc.execute({ limit: 20 });

    expect(repo.list).toHaveBeenCalledTimes(1);
    expect(repo.countPublishedRepliesByDiscussionIds).toHaveBeenCalledTimes(1);
    expect(repo.countPublishedRepliesByDiscussionIds).toHaveBeenCalledWith([D1, D2]);
    expect(voteRepo.countMany).toHaveBeenCalledTimes(1);

    expect(page.items).toEqual([
      expect.objectContaining({ id: D1, upvotes: 5, replyCount: 3 }),
      expect.objectContaining({ id: D2, upvotes: 1, replyCount: 0 }),
    ]);
  });

  it('replyCount 0 jika tidak ada baris count', async () => {
    const repo = {
      list: vi.fn().mockResolvedValue({
        items: [makeHelp(D1)],
        nextCursor: null,
        hasMore: false,
      }),
      countPublishedRepliesByDiscussionIds: vi.fn().mockResolvedValue(new Map()),
    } as unknown as DiscussionRepository;

    const voteRepo = {
      countMany: vi.fn().mockResolvedValue(new Map()),
    } as unknown as VoteRepository;

    const uc = new ListPublishedDiscussionsUseCase(repo, voteRepo);
    const page = await uc.execute({ limit: 10, sort: 'popular' });

    expect(page.items[0]).toMatchObject({ id: D1, upvotes: 0, replyCount: 0 });
  });
});
