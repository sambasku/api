import { describe, it, expect, vi } from 'vitest';
import { ConflictError, ForbiddenError, NotFoundError } from '@/shared/errors/app-error';
import { AttachCommentImageUseCase } from '../../application/use-cases/attach-comment-image.use-case';
import { ApproveCommentImageUseCase } from '../../application/use-cases/approve-comment-image.use-case';
import { RejectCommentImageUseCase } from '../../application/use-cases/reject-comment-image.use-case';
import type { Comment } from '../../domain/entities/comment.entity';

const WORD = '01JDWORDMAKATN0000000000A';
const AUTHOR = '01JDUSERAUTHOR00000000000A';
const ADMIN = '01JDUSERADMIN000000000000A';
const OTHER = '01JDUSEROTHER000000000000A';

/** Minimal JPEG (SOI + EOI) supaya validateImageFile lolos. */
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: '01JDCOMMENTMAKATN00000000A',
    wordId: WORD,
    wordLemma: 'makatn',
    userId: AUTHOR,
    username: 'budi',
    displayName: 'budi',
    avatarUrl: null,
    userRole: 'contributor',
    body: 'halo',
    bodyOriginal: null,
    audio: null,
    image: null,
    status: 'published',
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date('2026-09-18T10:00:00Z'),
    updatedAt: null,
    isEdited: false,
    ...overrides,
  };
}

const pendingImage = {
  url: 'https://ik.imagekit.io/x/staging.jpg',
  provider: 'imagekit',
  providerFileId: 'file_abc',
  publicUrl: null,
  status: 'pending_review' as const,
  contentWarnings: [] as string[],
  reviewedBy: null,
  reviewedAt: null,
};

describe('AttachCommentImageUseCase', () => {
  it('penulis boleh lampirkan; non-penulis 403; sudah pending 409', async () => {
    const commentRepo = {
      findById: vi.fn().mockResolvedValue(makeComment()),
      setPendingImage: vi
        .fn()
        .mockResolvedValue(makeComment({ image: pendingImage })),
    };
    const auditRepo = { record: vi.fn() };
    const uc = new AttachCommentImageUseCase(
      commentRepo as never,
      auditRepo as never,
    );

    const ok = await uc.execute({
      commentId: '01JDCOMMENTMAKATN00000000A',
      userId: AUTHOR,
      url: pendingImage.url,
      providerFileId: pendingImage.providerFileId,
    });
    expect(ok.image?.status).toBe('pending_review');
    expect(auditRepo.record).toHaveBeenCalled();

    commentRepo.findById.mockResolvedValue(makeComment({ userId: OTHER }));
    await expect(
      uc.execute({
        commentId: '01JDCOMMENTMAKATN00000000A',
        userId: AUTHOR,
        url: pendingImage.url,
        providerFileId: pendingImage.providerFileId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    commentRepo.findById.mockResolvedValue(makeComment({ image: pendingImage }));
    await expect(
      uc.execute({
        commentId: '01JDCOMMENTMAKATN00000000A',
        userId: AUTHOR,
        url: pendingImage.url,
        providerFileId: pendingImage.providerFileId,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('ApproveCommentImageUseCase', () => {
  it('promote staging → published; bukan pending → 409', async () => {
    const commentRepo = {
      findById: vi.fn().mockResolvedValue(makeComment({ image: pendingImage })),
      approveImage: vi.fn().mockResolvedValue(
        makeComment({
          image: {
            ...pendingImage,
            status: 'published',
            publicUrl: 'https://cdn.jsdelivr.net/gh/x/assets/comments/a.jpg',
            provider: 'github',
            providerFileId: 'assets/comments/a.jpg',
            url: 'https://cdn.jsdelivr.net/gh/x/assets/comments/a.jpg',
          },
        }),
      ),
    };
    const publicImageStorage = {
      providerName: 'github',
      upload: vi.fn().mockResolvedValue({
        path: 'assets/comments/a.jpg',
        url: 'https://cdn.jsdelivr.net/gh/x/assets/comments/a.jpg',
        sha: 'sha',
        size: 10,
      }),
    };
    const imageStorage = { deleteFile: vi.fn().mockResolvedValue(undefined) };
    const auditRepo = { record: vi.fn() };

    const uc = new ApproveCommentImageUseCase(
      commentRepo as never,
      publicImageStorage as never,
      imageStorage as never,
      auditRepo as never,
    );

    const approved = await uc.execute({
      commentId: '01JDCOMMENTMAKATN00000000A',
      actorId: ADMIN,
      censoredBytes: JPEG_BYTES,
      censoredMimeType: 'image/jpeg',
      contentWarnings: [],
    });
    expect(approved.image?.status).toBe('published');
    expect(publicImageStorage.upload).toHaveBeenCalled();
    expect(imageStorage.deleteFile).toHaveBeenCalledWith('file_abc');

    commentRepo.findById.mockResolvedValue(makeComment({ image: null }));
    await expect(
      uc.execute({
        commentId: '01JDCOMMENTMAKATN00000000A',
        actorId: ADMIN,
        censoredBytes: JPEG_BYTES,
        censoredMimeType: 'image/jpeg',
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('RejectCommentImageUseCase', () => {
  it('hapus staging + status rejected; hilang → 404', async () => {
    const commentRepo = {
      findById: vi.fn().mockResolvedValue(makeComment({ image: pendingImage })),
      rejectImage: vi.fn().mockResolvedValue(
        makeComment({
          image: {
            ...pendingImage,
            status: 'rejected',
            url: '',
            provider: '',
            providerFileId: '',
          },
        }),
      ),
    };
    const imageStorage = { deleteFile: vi.fn().mockResolvedValue(undefined) };
    const auditRepo = { record: vi.fn() };
    const uc = new RejectCommentImageUseCase(
      commentRepo as never,
      imageStorage as never,
      auditRepo as never,
    );

    const rejected = await uc.execute({
      commentId: '01JDCOMMENTMAKATN00000000A',
      actorId: ADMIN,
    });
    expect(rejected.image?.status).toBe('rejected');
    expect(imageStorage.deleteFile).toHaveBeenCalledWith('file_abc');

    commentRepo.findById.mockResolvedValue(null);
    await expect(
      uc.execute({ commentId: '01JDCOMMENTMAKATN00000000A', actorId: ADMIN }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
