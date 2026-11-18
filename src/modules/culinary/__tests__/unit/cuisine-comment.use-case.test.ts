import { describe, it, expect, vi } from 'vitest';
import { CreateCuisineCommentUseCase } from '../../application/use-cases/cuisine-comment.use-cases';
import type { CulinaryRepository } from '../../domain/repositories/culinary.repository';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';

const CUISINE_ID = '01CUISINE0000000000000001';
const USER_ID = '01USER000000000000000001';
const COMMENT_ID = '01COMMENT000000000000000001';

const baseComment = {
  id: COMMENT_ID,
  cuisineId: CUISINE_ID,
  userId: USER_ID,
  username: 'testuser',
  displayName: 'Test User',
  avatarUrl: null,
  userRole: null,
  authorDeletedAt: null,
  body: 'Enak!',
  status: 'published' as const,
  isEdited: false,
  createdAt: new Date('2026-11-01T10:00:00Z'),
  updatedAt: null,
};

function makeRepo(over: Partial<CulinaryRepository> = {}): CulinaryRepository {
  return {
    createCuisine: vi.fn(),
    updateCuisine: vi.fn(),
    softDeleteCuisine: vi.fn(),
    findCuisineById: vi.fn(),
    findCuisineBySlug: vi.fn(),
    listCuisines: vi.fn(),
    existingCuisineSlugs: vi.fn(),
    findCuisineDuplicates: vi.fn(),
    createPlace: vi.fn(),
    updatePlace: vi.fn(),
    softDeletePlace: vi.fn(),
    findPlaceById: vi.fn(),
    findPlaceBySlug: vi.fn(),
    listPlaces: vi.fn(),
    existingPlaceSlugs: vi.fn(),
    findPlaceDuplicates: vi.fn(),
    createLink: vi.fn(),
    updateLink: vi.fn(),
    softDeleteLink: vi.fn(),
    findLinkById: vi.fn(),
    findLinkByPair: vi.fn(),
    linksForCuisine: vi.fn(),
    linksForPlace: vi.fn(),
    categoryRef: vi.fn(),
    listCategories: vi.fn(),
    createComment: vi.fn().mockResolvedValue(baseComment),
    findCommentById: vi.fn(),
    listComments: vi.fn(),
    updateCommentWithRevision: vi.fn(),
    markCommentDeletedByAuthor: vi.fn(),
    takedownComment: vi.fn(),
    cuisineTargetExists: vi.fn().mockResolvedValue(true),
    ...over,
  } as CulinaryRepository;
}

describe('CreateCuisineCommentUseCase', () => {
  it('membuat komentar dan emit activity event', async () => {
    const repo = makeRepo();
    const audit = { record: vi.fn() } as unknown as AuditLogRepository;
    const blocklist = {
      listAllActiveWords: vi.fn().mockResolvedValue([]),
    } as unknown as CommentBlocklistRepository;
    const activityEvents = { safe: vi.fn().mockResolvedValue(undefined) };
    const uc = new CreateCuisineCommentUseCase(
      repo,
      audit,
      blocklist,
      undefined,
      activityEvents as never,
    );

    const result = await uc.execute({
      cuisineId: CUISINE_ID,
      userId: USER_ID,
      body: 'Enak!',
    });
    expect(result.id).toBe(COMMENT_ID);
    expect(activityEvents.safe).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'cuisine_comment_created',
        actorId: USER_ID,
        targetId: COMMENT_ID,
      }),
    );
  });
});