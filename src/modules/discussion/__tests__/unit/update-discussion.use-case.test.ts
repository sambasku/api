import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenError, NotFoundError } from '@/shared/errors/app-error';
import { UpdateDiscussionUseCase } from '../../application/use-cases/update-discussion.use-case';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';
import type { Discussion } from '../../domain/entities/discussion.entity';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';

vi.mock('@/modules/word/application/utils/assert-can-contribute', () => ({
  assertCanContribute: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/shared/moderation/assert-ugc-text-quality-with-strike', () => ({
  assertUgcTextQualityWithStrike: vi.fn(async (text: string) => text),
}));

const DISC_ID = '01JDDISC000000000000000001';
const ACTOR = '01JDACTOR00000000000000001';
const OTHER = '01JDOTHER00000000000000001';

function makeDiscussion(overrides: Partial<Discussion> = {}): Discussion {
  return {
    id: DISC_ID,
    userId: ACTOR,
    username: 'pemilik',
    displayName: 'Budi',
    avatarUrl: null,
    userRole: null,
    body: 'teks lama yang cukup',
    bodyOriginal: null,
    linkUrl: null,
    images: [],
    audio: null,
    status: 'published',
    rejectionNote: null,
    reviewedBy: null,
    reviewedAt: null,
    pinnedReplyId: null,
    lastReplyAt: null,
    publishedReplyCount: 0,
    createdAt: new Date('2026-09-24T01:00:00Z'),
    updatedAt: null,
    isEdited: false,
    ...overrides,
  };
}

function makeRepo(overrides: Partial<DiscussionRepository> = {}) {
  return {
    findById: vi.fn().mockResolvedValue(makeDiscussion()),
    updateDiscussionBodyWithRevision: vi.fn().mockImplementation(async () =>
      makeDiscussion({
        body: 'teks baru yang aman',
        status: 'pending_review',
        isEdited: true,
        updatedAt: new Date(),
      }),
    ),
    ...overrides,
  } as unknown as DiscussionRepository;
}

describe('UpdateDiscussionUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bukan penulis → 403', async () => {
    const uc = new UpdateDiscussionUseCase(
      makeRepo({
        findById: vi.fn().mockResolvedValue(makeDiscussion({ userId: OTHER })),
      }),
      { record: vi.fn() } as unknown as AuditLogRepository,
      { listAllActiveWords: vi.fn().mockResolvedValue([]) } as unknown as CommentBlocklistRepository,
    );
    await expect(
      uc.execute({ discussionId: DISC_ID, actorId: ACTOR, body: 'teks baru yang aman' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('non-published → 404', async () => {
    const uc = new UpdateDiscussionUseCase(
      makeRepo({
        findById: vi
          .fn()
          .mockResolvedValue(makeDiscussion({ status: 'pending_review' })),
      }),
      { record: vi.fn() } as unknown as AuditLogRepository,
      { listAllActiveWords: vi.fn().mockResolvedValue([]) } as unknown as CommentBlocklistRepository,
    );
    await expect(
      uc.execute({ discussionId: DISC_ID, actorId: ACTOR, body: 'teks baru yang aman' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('published → pending_review + requeue flag', async () => {
    const updateRevision = vi.fn().mockResolvedValue(
      makeDiscussion({
        body: 'teks baru yang aman',
        status: 'pending_review',
        isEdited: true,
      }),
    );
    const audit = { record: vi.fn() };
    const uc = new UpdateDiscussionUseCase(
      makeRepo({ updateDiscussionBodyWithRevision: updateRevision }),
      audit as unknown as AuditLogRepository,
      { listAllActiveWords: vi.fn().mockResolvedValue([]) } as unknown as CommentBlocklistRepository,
    );
    const result = await uc.execute({
      discussionId: DISC_ID,
      actorId: ACTOR,
      body: 'teks baru yang aman',
    });
    expect(result.status).toBe('pending_review');
    expect(updateRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        discussionId: DISC_ID,
        requeuePendingReview: true,
        body: 'teks baru yang aman',
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        entityType: 'discussion',
        newData: expect.objectContaining({ status: 'pending_review', requeued: true }),
      }),
    );
  });
});
