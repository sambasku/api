import { describe, it, expect, vi } from 'vitest';
import { NotFoundError } from '@/shared/errors/app-error';
import { GetDiscussionReplyEditHistoryUseCase } from '../../application/use-cases/get-discussion-reply-edit-history.use-case';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';
import type { DiscussionReply } from '../../domain/entities/discussion.entity';

const REPLY_ID = '01JDREPLY00000000000000001';

function makeReply(overrides: Partial<DiscussionReply> = {}): DiscussionReply {
  return {
    id: REPLY_ID,
    discussionId: '01JDDISC000000000000000001',
    userId: '01JDACTOR00000000000000001',
    username: 'pembalas',
    displayName: 'Ani',
    avatarUrl: null,
    userRole: null,
    body: 'teks sekarang',
    bodyOriginal: null,
    audio: null,
    status: 'published',
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date('2026-09-24T01:00:00Z'),
    updatedAt: new Date('2026-09-24T02:00:00Z'),
    isEdited: true,
    ...overrides,
  };
}

describe('GetDiscussionReplyEditHistoryUseCase', () => {
  it('taken_down → 404 anti-leak', async () => {
    const repo = {
      findReplyById: vi.fn().mockResolvedValue(makeReply({ status: 'taken_down' })),
      listReplyRevisions: vi.fn(),
    } as unknown as DiscussionRepository;
    const uc = new GetDiscussionReplyEditHistoryUseCase(repo);
    await expect(uc.execute(REPLY_ID)).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.listReplyRevisions).not.toHaveBeenCalled();
  });

  it('published → current + revisions', async () => {
    const repo = {
      findReplyById: vi.fn().mockResolvedValue(makeReply()),
      listReplyRevisions: vi.fn().mockResolvedValue([
        {
          id: '01JDREV0000000000000000001',
          replyId: REPLY_ID,
          editorId: '01JDACTOR00000000000000001',
          body: 'teks lama',
          createdAt: new Date('2026-09-24T01:30:00Z'),
        },
      ]),
    } as unknown as DiscussionRepository;
    const uc = new GetDiscussionReplyEditHistoryUseCase(repo);
    const result = await uc.execute(REPLY_ID);
    expect(result.current.body).toBe('teks sekarang');
    expect(result.current.is_edited).toBe(true);
    expect(result.revisions).toHaveLength(1);
    expect(result.revisions[0].body).toBe('teks lama');
  });
});
