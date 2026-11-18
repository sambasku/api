import { describe, it, expect, vi } from 'vitest';
import { CreateUsahaCommentUseCase } from '../../application/use-cases/usaha-comment.use-cases';
import type { UsahaRepository } from '../../domain/repositories/usaha.repository';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';

const USAHA_ID = '01USAHA000000000000000001';
const USER_ID = '01USER000000000000000001';
const COMMENT_ID = '01COMMENT000000000000000001';

const baseComment = {
  id: COMMENT_ID,
  usahaId: USAHA_ID,
  userId: USER_ID,
  username: 'testuser',
  displayName: 'Test User',
  avatarUrl: null,
  userRole: null,
  authorDeletedAt: null,
  body: 'Usaha ramah!',
  status: 'published' as const,
  isEdited: false,
  createdAt: new Date('2026-11-01T10:00:00Z'),
  updatedAt: null,
};

function makeRepo(over: Partial<UsahaRepository> = {}): UsahaRepository {
  return {
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    findById: vi.fn(),
    findBySlug: vi.fn(),
    list: vi.fn(),
    listCategories: vi.fn(),
    existingSlugs: vi.fn(),
    findDuplicates: vi.fn(),
    listImages: vi.fn(),
    appendImages: vi.fn(),
    countUploadsSince: vi.fn(),
    hideImage: vi.fn(),
    createComment: vi.fn().mockResolvedValue(baseComment),
    findCommentById: vi.fn(),
    listComments: vi.fn(),
    updateCommentWithRevision: vi.fn(),
    markCommentDeletedByAuthor: vi.fn(),
    takedownComment: vi.fn(),
    usahaTargetExists: vi.fn().mockResolvedValue(true),
    ...over,
  } as UsahaRepository;
}

describe('CreateUsahaCommentUseCase', () => {
  it('membuat komentar dan emit activity event', async () => {
    const repo = makeRepo();
    const audit = { record: vi.fn() } as unknown as AuditLogRepository;
    const blocklist = {
      listAllActiveWords: vi.fn().mockResolvedValue([]),
    } as unknown as CommentBlocklistRepository;
    const activityEvents = { safe: vi.fn().mockResolvedValue(undefined) };
    const uc = new CreateUsahaCommentUseCase(
      repo,
      audit,
      blocklist,
      undefined,
      activityEvents as never,
    );

    const result = await uc.execute({
      usahaId: USAHA_ID,
      userId: USER_ID,
      body: 'Usaha ramah!',
    });
    expect(result.id).toBe(COMMENT_ID);
    expect(activityEvents.safe).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'usaha_comment_created',
        actorId: USER_ID,
        targetId: COMMENT_ID,
      }),
    );
  });
});