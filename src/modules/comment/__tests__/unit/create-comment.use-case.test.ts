import { describe, it, expect, vi } from 'vitest';
import { ConflictError, NotFoundError } from '@/shared/errors/app-error';
import { CSV_IMPORTER_USER_ID } from '@/shared/constants/csv-importer';
import { CreateCommentUseCase } from '../../application/use-cases/create-comment.use-case';
import { DeleteCommentUseCase } from '../../application/use-cases/delete-comment.use-case';
import { TakedownCommentUseCase } from '../../application/use-cases/takedown-comment.use-case';
import type { Comment } from '../../domain/entities/comment.entity';
import { applyBlocklistFilter } from '@/modules/comment-blocklist/application/utils/apply-blocklist-filter';

const WORD = '01JDWORDMAKATN0000000000A';
const AUTHOR = '01JDUSERAUTHOR00000000000A';
const ADMIN = '01JDUSERADMIN000000000000A';
const OTHER = '01JDUSEROTHER000000000000A';
const OWNER = '01JDUSEROWNER000000000000A';

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
    status: 'published',
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date('2026-09-18T10:00:00Z'),
    ...overrides,
  };
}

describe('applyBlocklistFilter', () => {
  it('mengganti whole-word case-insensitive dengan ***', () => {
    expect(applyBlocklistFilter('Ini Bodoh sekali', ['bodoh'])).toBe('Ini *** sekali');
    expect(applyBlocklistFilter('bodohan tetap', ['bodoh'])).toBe('bodohan tetap');
  });
});

describe('CreateCommentUseCase', () => {
  it('word hilang → 404; sukses → published + body terfilter + audit', async () => {
    const commentRepo = {
      create: vi.fn().mockResolvedValue(makeComment({ body: 'Ini *** sekali' })),
      findById: vi.fn().mockResolvedValue(makeComment({ body: 'Ini *** sekali' })),
      listDistinctCommenterUserIds: vi.fn().mockResolvedValue([AUTHOR]),
    };
    const wordRepo = { findById: vi.fn().mockResolvedValue(null) };
    const auditRepo = { record: vi.fn() };
    const blocklistRepo = { listAllActiveWords: vi.fn().mockResolvedValue(['bodoh']) };

    const uc = new CreateCommentUseCase(
      commentRepo as never,
      wordRepo as never,
      auditRepo as never,
      blocklistRepo as never,
    );

    await expect(
      uc.execute({ wordId: WORD, userId: AUTHOR, role: 'contributor', body: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundError);

    wordRepo.findById.mockResolvedValue({
      id: WORD,
      status: 'published',
      lemma: 'makatn',
      createdBy: null,
    });
    const created = await uc.execute({
      wordId: WORD,
      userId: AUTHOR,
      role: 'contributor',
      body: 'Ini Bodoh sekali',
    });
    expect(commentRepo.create).toHaveBeenCalledWith({
      wordId: WORD,
      userId: AUTHOR,
      body: 'Ini *** sekali',
      bodyOriginal: 'Ini Bodoh sekali',
    });
    expect(created.status).toBe('published');
    expect(auditRepo.record).toHaveBeenCalled();
  });

  it('notif inbox + push ke prior commenter dan owner (bukan aktor / CSV)', async () => {
    const commentRepo = {
      create: vi.fn().mockResolvedValue(makeComment({ body: 'Halo semua' })),
      findById: vi.fn().mockResolvedValue(makeComment({ body: 'Halo semua' })),
      listDistinctCommenterUserIds: vi.fn().mockResolvedValue([AUTHOR, OTHER, CSV_IMPORTER_USER_ID]),
    };
    const wordRepo = {
      findById: vi.fn().mockResolvedValue({
        id: WORD,
        status: 'published',
        lemma: 'makatn',
        createdBy: OWNER,
      }),
    };
    const auditRepo = { record: vi.fn() };
    const blocklistRepo = { listAllActiveWords: vi.fn().mockResolvedValue([]) };
    const userRepo = {
      findById: vi.fn().mockResolvedValue({
        id: AUTHOR,
        displayName: 'John Doe',
        username: 'johndoe',
      }),
    };
    const inbox = { execute: vi.fn().mockResolvedValue(undefined) };
    const notifyUser = { execute: vi.fn().mockResolvedValue(undefined) };
    const pushCooldown = {
      maySend: vi.fn().mockResolvedValue(true),
      touchAfterSend: vi.fn().mockResolvedValue(undefined),
    };

    const uc = new CreateCommentUseCase(
      commentRepo as never,
      wordRepo as never,
      auditRepo as never,
      blocklistRepo as never,
      userRepo as never,
      inbox as never,
      notifyUser as never,
      pushCooldown as never,
    );

    await uc.execute({
      wordId: WORD,
      userId: AUTHOR,
      role: 'contributor',
      body: 'Halo semua',
    });

    const expectedBody = 'John Doe juga berkomentar di "makatn": Halo semua';
    expect(inbox.execute).toHaveBeenCalledTimes(2);
    expect(notifyUser.execute).toHaveBeenCalledTimes(2);
    expect(pushCooldown.touchAfterSend).toHaveBeenCalledTimes(2);

    const inboxUserIds = inbox.execute.mock.calls
      .map((c: unknown[]) => (c[0] as { userId: string }).userId)
      .sort();
    expect(inboxUserIds).toEqual([OTHER, OWNER].sort());

    expect(inbox.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: OTHER,
        type: 'word_comment',
        targetKind: 'word',
        targetId: WORD,
        actorId: AUTHOR,
        title: 'Komentar baru',
        body: expectedBody,
        refreshOnConflict: true,
      }),
    );
    expect(notifyUser.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: OWNER,
        title: 'Komentar baru',
        body: expectedBody,
        data: {
          type: 'word_comment',
          target_kind: 'word',
          target_id: WORD,
        },
      }),
    );
  });

  it('cooldown aktif → inbox tetap, push di-skip', async () => {
    const commentRepo = {
      create: vi.fn().mockResolvedValue(makeComment({ body: 'lagi' })),
      findById: vi.fn().mockResolvedValue(makeComment({ body: 'lagi' })),
      listDistinctCommenterUserIds: vi.fn().mockResolvedValue([AUTHOR, OTHER]),
    };
    const wordRepo = {
      findById: vi.fn().mockResolvedValue({
        id: WORD,
        status: 'published',
        lemma: 'makatn',
        createdBy: null,
      }),
    };
    const auditRepo = { record: vi.fn() };
    const blocklistRepo = { listAllActiveWords: vi.fn().mockResolvedValue([]) };
    const inbox = { execute: vi.fn().mockResolvedValue(undefined) };
    const notifyUser = { execute: vi.fn().mockResolvedValue(undefined) };
    const pushCooldown = {
      maySend: vi.fn().mockResolvedValue(false),
      touchAfterSend: vi.fn().mockResolvedValue(undefined),
    };

    const uc = new CreateCommentUseCase(
      commentRepo as never,
      wordRepo as never,
      auditRepo as never,
      blocklistRepo as never,
      undefined,
      inbox as never,
      notifyUser as never,
      pushCooldown as never,
    );

    await uc.execute({
      wordId: WORD,
      userId: AUTHOR,
      role: 'contributor',
      body: 'lagi',
    });

    expect(inbox.execute).toHaveBeenCalledTimes(1);
    expect(notifyUser.execute).not.toHaveBeenCalled();
    expect(pushCooldown.touchAfterSend).not.toHaveBeenCalled();
  });

  it('gagal notify tidak menggagalkan create', async () => {
    const commentRepo = {
      create: vi.fn().mockResolvedValue(makeComment()),
      findById: vi.fn().mockResolvedValue(makeComment()),
      listDistinctCommenterUserIds: vi.fn().mockRejectedValue(new Error('db down')),
    };
    const wordRepo = {
      findById: vi.fn().mockResolvedValue({
        id: WORD,
        status: 'published',
        lemma: 'makatn',
        createdBy: OWNER,
      }),
    };
    const auditRepo = { record: vi.fn() };
    const blocklistRepo = { listAllActiveWords: vi.fn().mockResolvedValue([]) };

    const uc = new CreateCommentUseCase(
      commentRepo as never,
      wordRepo as never,
      auditRepo as never,
      blocklistRepo as never,
      undefined,
      { execute: vi.fn() } as never,
      { execute: vi.fn() } as never,
    );

    await expect(
      uc.execute({ wordId: WORD, userId: AUTHOR, role: 'contributor', body: 'ok' }),
    ).resolves.toMatchObject({ id: '01JDCOMMENTMAKATN00000000A' });
  });
});

describe('DeleteCommentUseCase', () => {
  it('penulis OK; non-penulis 403; admin juga 403 (pakai takedown)', async () => {
    const comment = makeComment();
    const commentRepo = {
      findById: vi.fn().mockResolvedValue(comment),
      markDeletedByAuthor: vi.fn().mockResolvedValue(true),
    };
    const auditRepo = { record: vi.fn() };
    const uc = new DeleteCommentUseCase(commentRepo as never, auditRepo as never);

    await uc.execute({ commentId: comment.id, actorId: AUTHOR, role: 'contributor' });
    expect(commentRepo.markDeletedByAuthor).toHaveBeenCalledWith(comment.id, AUTHOR);

    await expect(
      uc.execute({ commentId: comment.id, actorId: OTHER, role: 'contributor' }),
    ).rejects.toMatchObject({ statusCode: 403 });

    await expect(
      uc.execute({ commentId: comment.id, actorId: ADMIN, role: 'admin' }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('TakedownCommentUseCase', () => {
  it('sukses taken_down; race → 409 COMMENT_ALREADY_MODERATED', async () => {
    const comment = makeComment();
    const commentRepo = {
      findById: vi
        .fn()
        .mockResolvedValueOnce(comment)
        .mockResolvedValueOnce({ ...comment, status: 'taken_down', reviewedBy: ADMIN, reviewedAt: new Date() }),
      takedown: vi.fn().mockResolvedValue(true),
    };
    const auditRepo = { record: vi.fn() };
    const uc = new TakedownCommentUseCase(commentRepo as never, auditRepo as never);

    const result = await uc.execute({ commentId: comment.id, reviewerId: ADMIN });
    expect(result.status).toBe('taken_down');
    expect(auditRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'takedown', newData: { status: 'taken_down' } }),
    );

    commentRepo.takedown.mockResolvedValue(false);
    commentRepo.findById.mockResolvedValue(comment);
    await expect(uc.execute({ commentId: comment.id, reviewerId: ADMIN })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});
