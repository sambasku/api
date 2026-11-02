import { describe, it, expect, vi } from 'vitest';
import { NotFoundError } from '@/shared/errors/app-error';
import { GetCommentEditHistoryUseCase } from '../../application/use-cases/get-comment-edit-history.use-case';
import type { CommentRepository } from '../../domain/repositories/comment.repository';
import type { Comment } from '../../domain/entities/comment.entity';

const COMMENT_ID = '01JDCOMMENTMAKATN00000000A';

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: COMMENT_ID,
    wordId: '01JDWORDMAKATN0000000000A',
    wordLemma: 'makatn',
    userId: '01JDUSERAUTHOR00000000000A',
    username: 'budi',
    displayName: 'budi',
    avatarUrl: null,
    userRole: 'contributor',
    body: 'teks sekarang',
    bodyOriginal: null,
    audio: null,
    image: null,
    status: 'published',
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date('2026-09-18T10:00:00Z'),
    updatedAt: new Date('2026-09-18T11:00:00Z'),
    isEdited: true,
    ...overrides,
  };
}

describe('GetCommentEditHistoryUseCase', () => {
  it('taken_down → 404 anti-leak', async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue(makeComment({ status: 'taken_down' })),
      listRevisions: vi.fn(),
    } as unknown as CommentRepository;
    const uc = new GetCommentEditHistoryUseCase(repo);
    await expect(uc.execute(COMMENT_ID)).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.listRevisions).not.toHaveBeenCalled();
  });

  it('deleted_by_author → 404 anti-leak', async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue(makeComment({ status: 'deleted_by_author' })),
      listRevisions: vi.fn(),
    } as unknown as CommentRepository;
    const uc = new GetCommentEditHistoryUseCase(repo);
    await expect(uc.execute(COMMENT_ID)).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.listRevisions).not.toHaveBeenCalled();
  });

  it('published → current + revisions', async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue(makeComment()),
      listRevisions: vi.fn().mockResolvedValue([
        {
          id: '01JDREV0000000000000000001',
          commentId: COMMENT_ID,
          editorId: '01JDUSERAUTHOR00000000000A',
          body: 'teks lama',
          createdAt: new Date('2026-09-18T10:30:00Z'),
        },
      ]),
    } as unknown as CommentRepository;
    const uc = new GetCommentEditHistoryUseCase(repo);
    const result = await uc.execute(COMMENT_ID);
    expect(result.current.body).toBe('teks sekarang');
    expect(result.current.is_edited).toBe(true);
    expect(result.revisions).toHaveLength(1);
    expect(result.revisions[0].body).toBe('teks lama');
  });
});
