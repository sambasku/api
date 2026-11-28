import { describe, it, expect, vi } from 'vitest';
import {
  CreatePhotoCommentUseCase,
  ListPhotoCommentsUseCase,
  UpdatePhotoCommentUseCase,
  photoNotificationActionValue,
} from '../../application/use-cases/photo-comment.use-cases';
import type {
  PhotoComment,
  ResolvedPhoto,
} from '../../domain/entities/photo-comment.entity';
import type {
  PhotoCommentRepository,
  PhotoResolver,
} from '../../domain/repositories/photo-comment.repository';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import { ForbiddenError, NotFoundError } from '@/shared/errors/app-error';

const UPLOADER = '01UPLOADER00000000000000001';
const COMMENTER = '01COMMENTER0000000000000001';
const OTHER = '01OTHERUSER0000000000000001';
const PHOTO_REF = '01PHOTO0000000000000000001';

const photo: ResolvedPhoto = {
  kind: 'place',
  ref: PHOTO_REF,
  hostId: '01PLACE000000000000000001',
  hostKey: 'pantai-tanjung-batu',
  hostLabel: 'Pantai Tanjung Batu',
  uploaderId: UPLOADER,
};

function comment(over: Partial<PhotoComment> = {}): PhotoComment {
  return {
    id: '01COMMENT000000000000000001',
    photoKind: 'place',
    photoRef: PHOTO_REF,
    hostId: photo.hostId,
    parentId: null,
    userId: COMMENTER,
    username: 'pengomentar',
    displayName: 'Pengomentar',
    avatarUrl: null,
    userRole: null,
    authorDeletedAt: null,
    body: 'Fotonya bagus, ini pantai yang mana ya?',
    status: 'published',
    isEdited: false,
    createdAt: new Date('2026-11-01T10:00:00Z'),
    updatedAt: null,
    ...over,
  };
}

function makeRepo(over: Partial<PhotoCommentRepository> = {}): PhotoCommentRepository {
  return {
    createComment: vi.fn().mockResolvedValue(comment()),
    findCommentById: vi.fn(),
    listComments: vi.fn(),
    updateCommentWithRevision: vi.fn(),
    markCommentDeletedByAuthor: vi.fn(),
    takedownComment: vi.fn(),
    listCommentRevisions: vi.fn().mockResolvedValue([]),
    countByPhotos: vi.fn(),
    ...over,
  } as PhotoCommentRepository;
}

const audit = { record: vi.fn() } as unknown as AuditLogRepository;
const blocklist = {
  listAllActiveWords: vi.fn().mockResolvedValue([]),
} as unknown as CommentBlocklistRepository;

function makeResolver(result: ResolvedPhoto | null = photo): PhotoResolver {
  return { resolve: vi.fn().mockResolvedValue(result) };
}

function makeNotify() {
  return {
    userRepo: {
      findById: vi.fn().mockResolvedValue({
        id: COMMENTER,
        username: 'pengomentar',
        displayName: 'Pengomentar',
      }),
    },
    inbox: { execute: vi.fn().mockResolvedValue(undefined) },
    notifyUser: { execute: vi.fn().mockResolvedValue(undefined) },
    pushCooldown: {
      maySend: vi.fn().mockResolvedValue(true),
      touchAfterSend: vi.fn().mockResolvedValue(undefined),
    },
  };
}

function makeCreate(opts: {
  repo?: PhotoCommentRepository;
  resolver?: PhotoResolver;
  notify?: ReturnType<typeof makeNotify>;
  activity?: { safe: ReturnType<typeof vi.fn> };
}) {
  return new CreatePhotoCommentUseCase(
    opts.repo ?? makeRepo(),
    opts.resolver ?? makeResolver(),
    audit,
    blocklist,
    undefined,
    (opts.activity ?? { safe: vi.fn() }) as never,
    (opts.notify ?? makeNotify()) as never,
  );
}

describe('CreatePhotoCommentUseCase', () => {
  it('membuat komentar, catat event aktivitas, dan notif uploader', async () => {
    const notify = makeNotify();
    const activity = { safe: vi.fn().mockResolvedValue(undefined) };
    const uc = makeCreate({ notify, activity });

    const result = await uc.execute({
      kind: 'place',
      ref: PHOTO_REF,
      userId: COMMENTER,
      body: 'Fotonya bagus, ini pantai yang mana ya?',
    });

    expect(result.id).toBe('01COMMENT000000000000000001');
    expect(activity.safe).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'photo_comment_created',
        actorId: COMMENTER,
        targetId: '01COMMENT000000000000000001',
      }),
    );
    expect(notify.inbox.execute).toHaveBeenCalledTimes(1);
    expect(notify.inbox.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: UPLOADER,
        type: 'photo_comment',
        targetKind: 'photo',
        targetId: PHOTO_REF,
        actionKind: 'photo',
        actionValue: photoNotificationActionValue(photo),
      }),
    );
    expect(notify.notifyUser.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: UPLOADER,
        data: expect.objectContaining({ type: 'photo_comment', target_kind: 'photo' }),
      }),
    );
    expect(notify.pushCooldown.touchAfterSend).toHaveBeenCalledWith(UPLOADER);
  });

  it('tidak notif saat uploader mengomentari fotonya sendiri', async () => {
    const notify = makeNotify();
    const repo = makeRepo({
      createComment: vi.fn().mockResolvedValue(comment({ userId: UPLOADER })),
    });
    const uc = makeCreate({ repo, notify });
    await uc.execute({
      kind: 'place',
      ref: PHOTO_REF,
      userId: UPLOADER,
      body: 'Ini foto saya di pantai itu kemarin sore',
    });
    expect(notify.inbox.execute).not.toHaveBeenCalled();
    expect(notify.notifyUser.execute).not.toHaveBeenCalled();
  });

  it('tidak notif untuk foto tanpa uploader (stock)', async () => {
    const notify = makeNotify();
    const uc = makeCreate({
      resolver: makeResolver({ ...photo, uploaderId: null }),
      notify,
    });
    await uc.execute({
      kind: 'place',
      ref: PHOTO_REF,
      userId: COMMENTER,
      body: 'Fotonya bagus, ini pantai yang mana ya?',
    });
    expect(notify.inbox.execute).not.toHaveBeenCalled();
  });

  it('balasan: notif uploader (photo_comment) dan penulis induk (photo_comment_reply)', async () => {
    const notify = makeNotify();
    const parent = comment({ id: '01PARENT0000000000000000001', userId: OTHER });
    const repo = makeRepo({
      findCommentById: vi.fn().mockResolvedValue(parent),
      createComment: vi
        .fn()
        .mockResolvedValue(comment({ parentId: parent.id })),
    });
    const uc = makeCreate({ repo, notify });
    await uc.execute({
      kind: 'place',
      ref: PHOTO_REF,
      parentId: parent.id,
      userId: COMMENTER,
      body: 'Betul, ini di sisi barat pantainya',
    });
    const calls = notify.inbox.execute.mock.calls.map((c) => c[0]);
    expect(calls).toHaveLength(2);
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: UPLOADER, type: 'photo_comment' }),
        expect.objectContaining({ userId: OTHER, type: 'photo_comment_reply' }),
      ]),
    );
  });

  it('balasan ke komentar uploader tidak dobel notif', async () => {
    const notify = makeNotify();
    const parent = comment({ id: '01PARENT0000000000000000001', userId: UPLOADER });
    const repo = makeRepo({
      findCommentById: vi.fn().mockResolvedValue(parent),
      createComment: vi
        .fn()
        .mockResolvedValue(comment({ parentId: parent.id })),
    });
    const uc = makeCreate({ repo, notify });
    await uc.execute({
      kind: 'place',
      ref: PHOTO_REF,
      parentId: parent.id,
      userId: COMMENTER,
      body: 'Terima kasih infonya, saya coba ke sana',
    });
    expect(notify.inbox.execute).toHaveBeenCalledTimes(1);
    expect(notify.inbox.execute).toHaveBeenCalledWith(
      expect.objectContaining({ userId: UPLOADER, type: 'photo_comment' }),
    );
  });

  it('foto tidak ditemukan = NotFoundError, tidak menyimpan', async () => {
    const repo = makeRepo();
    const uc = makeCreate({ repo, resolver: makeResolver(null) });
    await expect(
      uc.execute({
        kind: 'cuisine',
        ref: 'x.y',
        userId: COMMENTER,
        body: 'Fotonya bagus, ini pantai yang mana ya?',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.createComment).not.toHaveBeenCalled();
  });

  it('gagal kirim notif tidak membatalkan komentar', async () => {
    const notify = makeNotify();
    notify.inbox.execute.mockRejectedValue(new Error('boom'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const uc = makeCreate({ notify });
    const result = await uc.execute({
      kind: 'place',
      ref: PHOTO_REF,
      userId: COMMENTER,
      body: 'Fotonya bagus, ini pantai yang mana ya?',
    });
    expect(result.id).toBe('01COMMENT000000000000000001');
    errSpy.mockRestore();
  });
});

describe('ListPhotoCommentsUseCase', () => {
  it('list hanya komentar published tanpa resolve foto', async () => {
    const repo = makeRepo({
      listComments: vi
        .fn()
        .mockResolvedValue({ items: [], nextCursor: null, hasMore: false }),
    });
    const uc = new ListPhotoCommentsUseCase(repo);
    await uc.execute('word', 'ref1', undefined, 20);
    expect(repo.listComments).toHaveBeenCalledWith('word', 'ref1', {
      status: 'published',
      cursor: undefined,
      limit: 20,
    });
  });
});

describe('UpdatePhotoCommentUseCase', () => {
  it('menolak edit komentar milik orang lain', async () => {
    const repo = makeRepo({
      findCommentById: vi.fn().mockResolvedValue(comment({ userId: OTHER })),
    });
    const uc = new UpdatePhotoCommentUseCase(repo, audit, blocklist);
    await expect(
      uc.execute({
        commentId: '01COMMENT000000000000000001',
        userId: COMMENTER,
        body: 'Isi baru yang cukup panjang untuk lolos',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
