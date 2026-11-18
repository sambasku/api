import { describe, it, expect, vi } from 'vitest';
import { CreatePlaceCommentUseCase } from '../../application/use-cases/place-comment.use-cases';
import type { PlaceRepository } from '../../domain/repositories/place.repository';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';

const PLACE_ID = '01PLACE000000000000000001';
const USER_ID = '01USER000000000000000001';
const COMMENT_ID = '01COMMENT000000000000000001';

const baseComment = {
  id: COMMENT_ID,
  placeId: PLACE_ID,
  userId: USER_ID,
  username: 'testuser',
  displayName: 'Test User',
  avatarUrl: null,
  userRole: null,
  authorDeletedAt: null,
  body: 'Wisata bagus!',
  status: 'published' as const,
  isEdited: false,
  createdAt: new Date('2026-11-01T10:00:00Z'),
  updatedAt: null,
};

function makeRepo(over: Partial<PlaceRepository> = {}): PlaceRepository {
  return {
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    findById: vi.fn(),
    findBySlug: vi.fn(),
    list: vi.fn(),
    findBySlugAny: vi.fn(),
    existingSlugs: vi.fn(),
    listImages: vi.fn(),
    appendImages: vi.fn(),
    hideImage: vi.fn(),
    countUploadsSince: vi.fn(),
    resolveRelated: vi.fn(),
    recordView: vi.fn(),
    viewTotals: vi.fn(),
    viewReport: vi.fn(),
    createComment: vi.fn().mockResolvedValue(baseComment),
    findCommentById: vi.fn(),
    listComments: vi.fn(),
    updateCommentWithRevision: vi.fn(),
    markCommentDeletedByAuthor: vi.fn(),
    takedownComment: vi.fn(),
    placeTargetExists: vi.fn().mockResolvedValue(true),
    ...over,
  } as PlaceRepository;
}

describe('CreatePlaceCommentUseCase', () => {
  it('membuat komentar dan emit activity event', async () => {
    const repo = makeRepo();
    const audit = { record: vi.fn() } as unknown as AuditLogRepository;
    const blocklist = {
      listAllActiveWords: vi.fn().mockResolvedValue([]),
    } as unknown as CommentBlocklistRepository;
    const activityEvents = { safe: vi.fn().mockResolvedValue(undefined) };
    const uc = new CreatePlaceCommentUseCase(
      repo,
      audit,
      blocklist,
      undefined,
      activityEvents as never,
    );

    const result = await uc.execute({
      placeId: PLACE_ID,
      userId: USER_ID,
      body: 'Wisata bagus!',
    });
    expect(result.id).toBe(COMMENT_ID);
    expect(activityEvents.safe).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'place_comment_created',
        actorId: USER_ID,
        targetId: COMMENT_ID,
      }),
    );
  });
});