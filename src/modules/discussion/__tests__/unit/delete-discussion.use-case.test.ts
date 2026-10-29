import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenError, NotFoundError } from '@/shared/errors/app-error';
import { DeleteDiscussionUseCase } from '../../application/use-cases/delete-discussion.use-case';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';
import type { Discussion } from '../../domain/entities/discussion.entity';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';

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
    body: 'teks',
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
    ...overrides,
  };
}

describe('DeleteDiscussionUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bukan penulis → 403', async () => {
    const uc = new DeleteDiscussionUseCase(
      {
        findById: vi.fn().mockResolvedValue(makeDiscussion({ userId: OTHER })),
        markDiscussionDeletedByAuthor: vi.fn(),
      } as unknown as DiscussionRepository,
      { record: vi.fn() } as unknown as AuditLogRepository,
    );
    await expect(
      uc.execute({ discussionId: DISC_ID, actorId: ACTOR }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('non-published → 404', async () => {
    const uc = new DeleteDiscussionUseCase(
      {
        findById: vi
          .fn()
          .mockResolvedValue(makeDiscussion({ status: 'pending_review' })),
        markDiscussionDeletedByAuthor: vi.fn(),
      } as unknown as DiscussionRepository,
      { record: vi.fn() } as unknown as AuditLogRepository,
    );
    await expect(
      uc.execute({ discussionId: DISC_ID, actorId: ACTOR }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('published → deleted_by_author + audit', async () => {
    const mark = vi.fn().mockResolvedValue(true);
    const audit = { record: vi.fn() };
    const uc = new DeleteDiscussionUseCase(
      {
        findById: vi.fn().mockResolvedValue(makeDiscussion()),
        markDiscussionDeletedByAuthor: mark,
      } as unknown as DiscussionRepository,
      audit as unknown as AuditLogRepository,
    );
    await uc.execute({ discussionId: DISC_ID, actorId: ACTOR });
    expect(mark).toHaveBeenCalledWith(DISC_ID, ACTOR);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'delete',
        entityType: 'discussion',
        newData: { status: 'deleted_by_author' },
      }),
    );
  });
});
