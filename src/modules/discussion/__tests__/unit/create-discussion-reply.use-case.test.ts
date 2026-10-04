import { describe, it, expect, vi } from 'vitest';
import { ConflictError, NotFoundError } from '@/shared/errors/app-error';
import { CreateDiscussionReplyUseCase } from '../../application/use-cases/create-discussion-reply.use-case';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';
import type { Discussion, DiscussionReply } from '../../domain/entities/discussion.entity';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import { CSV_IMPORTER_USER_ID } from '@/shared/constants/csv-importer';

const DISCUSSION_ID = '01JDDISC000000000000000001';
const OWNER = '01JDOWNER00000000000000001';
const ACTOR = '01JDACTOR00000000000000001';
const OTHER = '01JDOTHER00000000000000001';
const REPLY_ID = '01JDREPLY00000000000000001';

function makeDiscussion(overrides: Partial<Discussion> = {}): Discussion {
  return {
    id: DISCUSSION_ID,
    userId: OWNER,
    username: 'pemilik',
    displayName: 'Pemilik Thread',
    avatarUrl: null,
    body: 'Apa arti tulisan di papan pasar?',
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

function makeReply(overrides: Partial<DiscussionReply> = {}): DiscussionReply {
  return {
    id: REPLY_ID,
    discussionId: DISCUSSION_ID,
    userId: ACTOR,
    username: 'pembalas',
    displayName: 'Ani Warga',
    avatarUrl: null,
    userRole: 'contributor',
    body: 'Artinya "buka toko pagi-pagi".',
    bodyOriginal: null,
    audio: null,
    status: 'published',
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date('2026-09-24T01:00:00Z'),
    updatedAt: null,
    ...overrides,
  };
}

function makeRepo(overrides: Partial<DiscussionRepository> = {}) {
  return {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(makeDiscussion()),
    list: vi.fn(),
    updateStatus: vi.fn(),
    setPinnedReply: vi.fn(),
    createReply: vi.fn().mockResolvedValue(makeReply()),
    findReplyById: vi.fn().mockResolvedValue(makeReply()),
    listReplies: vi.fn(),
    listDistinctReplierUserIds: vi.fn().mockResolvedValue([OWNER, OTHER]),
    markReplyDeletedByAuthor: vi.fn(),
    takedownReply: vi.fn(),
    ...overrides,
  } as unknown as DiscussionRepository;
}

describe('CreateDiscussionReplyUseCase', () => {
  it('diskusi hilang → DISCUSSION_NOT_FOUND', async () => {
    const uc = new CreateDiscussionReplyUseCase(
      makeRepo({ findById: vi.fn().mockResolvedValue(null) }),
      { record: vi.fn() } as unknown as AuditLogRepository,
      { listAllActiveWords: vi.fn().mockResolvedValue([]) } as unknown as CommentBlocklistRepository,
    );
    await expect(
      uc.execute({ discussionId: DISCUSSION_ID, userId: ACTOR, body: 'halo' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('belum published → DISCUSSION_NOT_PUBLISHED', async () => {
    const uc = new CreateDiscussionReplyUseCase(
      makeRepo({
        findById: vi.fn().mockResolvedValue(makeDiscussion({ status: 'pending_review' })),
      }),
      { record: vi.fn() } as unknown as AuditLogRepository,
      { listAllActiveWords: vi.fn().mockResolvedValue([]) } as unknown as CommentBlocklistRepository,
    );
    await expect(
      uc.execute({ discussionId: DISCUSSION_ID, userId: ACTOR, body: 'halo' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('balasan → inbox + push ke pemilik & peserta; aktor & sistem di-skip; cooldown disentuh', async () => {
    const inbox = { execute: vi.fn().mockResolvedValue(undefined) };
    const notifyUser = { execute: vi.fn().mockResolvedValue(undefined) };
    const pushCooldown = {
      maySend: vi.fn().mockResolvedValue(true),
      touchAfterSend: vi.fn().mockResolvedValue(undefined),
    };
    const userRepo = {
      findById: vi.fn().mockResolvedValue({
        id: ACTOR,
        username: 'ani',
        displayName: 'Ani Warga',
      }),
    };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const repo = makeRepo({
      listDistinctReplierUserIds: vi
        .fn()
        .mockResolvedValue([OWNER, OTHER, ACTOR, CSV_IMPORTER_USER_ID]),
    });

    const uc = new CreateDiscussionReplyUseCase(
      repo,
      audit as unknown as AuditLogRepository,
      { listAllActiveWords: vi.fn().mockResolvedValue([]) } as unknown as CommentBlocklistRepository,
      userRepo as never,
      inbox as never,
      notifyUser as never,
      pushCooldown as never,
    );

    await uc.execute({
      discussionId: DISCUSSION_ID,
      userId: ACTOR,
      body: 'Artinya buka toko pagi-pagi',
    });

    expect(inbox.execute).toHaveBeenCalledTimes(2);
    expect(notifyUser.execute).toHaveBeenCalledTimes(2);
    expect(pushCooldown.touchAfterSend).toHaveBeenCalledTimes(2);

    expect(inbox.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: OWNER,
        type: 'discussion_reply',
        targetKind: 'discussion',
        targetId: DISCUSSION_ID,
        actionKind: 'discussion',
        title: 'Balasan baru',
        body: expect.stringContaining('Ani Warga juga membalas di'),
      }),
    );
    expect(notifyUser.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: OTHER,
        data: expect.objectContaining({
          type: 'discussion_reply',
          target_kind: 'discussion',
          action_kind: 'discussion',
        }),
      }),
    );
  });

  it('cooldown aktif → inbox tetap, push di-skip', async () => {
    const inbox = { execute: vi.fn().mockResolvedValue(undefined) };
    const notifyUser = { execute: vi.fn().mockResolvedValue(undefined) };
    const pushCooldown = {
      maySend: vi.fn().mockResolvedValue(false),
      touchAfterSend: vi.fn().mockResolvedValue(undefined),
    };

    const uc = new CreateDiscussionReplyUseCase(
      makeRepo({ listDistinctReplierUserIds: vi.fn().mockResolvedValue([OWNER, OTHER]) }),
      { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditLogRepository,
      { listAllActiveWords: vi.fn().mockResolvedValue([]) } as unknown as CommentBlocklistRepository,
      {
        findById: vi.fn().mockResolvedValue({
          id: ACTOR,
          username: 'ani',
          displayName: 'Ani',
        }),
      } as never,
      inbox as never,
      notifyUser as never,
      pushCooldown as never,
    );

    await uc.execute({
      discussionId: DISCUSSION_ID,
      userId: ACTOR,
      body: 'Balasan singkat',
    });

    expect(inbox.execute).toHaveBeenCalledTimes(2);
    expect(notifyUser.execute).not.toHaveBeenCalled();
    expect(pushCooldown.touchAfterSend).not.toHaveBeenCalled();
  });
});
