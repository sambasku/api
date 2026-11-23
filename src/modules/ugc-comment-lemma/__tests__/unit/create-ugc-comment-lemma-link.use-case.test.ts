import { describe, expect, it, vi } from 'vitest';
import { CreateUgcCommentLemmaLinkUseCase } from '../../application/use-cases/create-ugc-comment-lemma-link.use-case';
import type { UgcCommentLemmaRepository } from '../../domain/repositories/ugc-comment-lemma.repository';

describe('CreateUgcCommentLemmaLinkUseCase', () => {
  it('menolak span di luar body', async () => {
    const repo: UgcCommentLemmaRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      listActiveForComment: vi.fn().mockResolvedValue([]),
      listActiveForComments: vi.fn(),
      deleteById: vi.fn(),
      markStaleForComment: vi.fn(),
    };
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                body: 'halo',
                userId: 'u1',
                status: 'published',
                wordId: 'w1',
              },
            ]),
          }),
        }),
      }),
    } as never;

    const uc = new CreateUgcCommentLemmaLinkUseCase(
      db,
      repo,
      { findById: vi.fn().mockResolvedValue({ id: 'w2', status: 'published', isVerified: true, deletedAt: null }) },
      { record: vi.fn(), list: vi.fn() },
    );

    await expect(
      uc.execute({
        anchorKind: 'word_comment',
        hostId: 'w1',
        commentId: 'c1',
        userId: 'u1',
        start: 0,
        end: 10,
        wordId: 'w2',
      }),
    ).rejects.toThrow();
  });
});