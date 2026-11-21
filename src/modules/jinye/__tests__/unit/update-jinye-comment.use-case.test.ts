import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateJinyeCommentUseCase } from '../../application/use-cases/update-jinye-comment.use-case';
import { GetJinyeCommentEditHistoryUseCase } from '../../application/use-cases/get-jinye-comment-edit-history.use-case';
import { DeleteJinyeCommentUseCase } from '../../application/use-cases/delete-jinye-comment.use-case';
import type { Jinye, JinyeComment } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

vi.mock('@/modules/word/application/utils/assert-can-contribute', () => ({
  assertCanContribute: vi.fn(async () => undefined),
}));

vi.mock(
  '@/shared/moderation/assert-ugc-text-quality-with-strike',
  () => ({
    assertUgcTextQualityWithStrike: vi.fn(async (text: string) => text),
  }),
);

const JINYE_ID = '01JINYE0000000000000000001';
const COMMENT_ID = '01JINYECOMMENT000000000001';
const ACTOR = '01USER00000000000000000001';
const OTHER = '01USER00000000000000000002';

function makeJinye(overrides: Partial<Jinye> = {}): Jinye {
  return {
    id: JINYE_ID,
    userId: ACTOR,
    username: 'aji',
    displayName: 'Aji',
    avatarUrl: null,
    userRole: 'contributor',
    body: 'halo',
    bodyOriginal: null,
    images: [],
    audio: null,
    repostOfId: null,
    quoteBody: null,
    status: 'published',
    publishedCommentCount: 1,
    repostCount: 0,
    createdAt: new Date(),
    updatedAt: null,
    ...overrides,
  };
}

function makeComment(overrides: Partial<JinyeComment> = {}): JinyeComment {
  return {
    id: COMMENT_ID,
    jinyeId: JINYE_ID,
    parentId: null,
    userId: ACTOR,
    username: 'aji',
    displayName: 'Aji',
    avatarUrl: null,
    userRole: 'contributor',
    body: 'komen lama',
    bodyOriginal: null,
    stickerId: null,
    images: [],
    status: 'published',
    createdAt: new Date(),
    updatedAt: null,
    isEdited: false,
    ...overrides,
  };
}

function emptyRepo(overrides: Partial<JinyeRepository> = {}): JinyeRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(async () => makeJinye()),
    list: vi.fn(),
    findLatestCreatedAtByUser: vi.fn(),
    findLatestQuotaConsumingCreatedAtByUser: vi.fn(),
    updateBody: vi.fn(),
    listRevisions: vi.fn(),
    markLemmaLinksStale: vi.fn(),
    markCommentLemmaLinksStale: vi.fn(async () => 0),
    findPlainRepostByUser: vi.fn(),
    adjustRepostCount: vi.fn(),
    markDeletedByAuthor: vi.fn(),
    takedown: vi.fn(),
    setAudio: vi.fn(),
    createComment: vi.fn(),
    findCommentById: vi.fn(async () => makeComment()),
    listCommentsByJinyeId: vi.fn(),
    updateCommentWithRevision: vi.fn(async () =>
      makeComment({ body: 'komen baru', isEdited: true, updatedAt: new Date() }),
    ),
    listCommentRevisions: vi.fn(async () => []),
    markCommentDeletedByAuthor: vi.fn(async () => true),
    takedownComment: vi.fn(),
    incrementPublishedCommentCount: vi.fn(),
    setStatus: vi.fn(),
    getPinnedJinyeId: vi.fn(),
    setPinnedJinyeId: vi.fn(),
    clearPinnedIf: vi.fn(),
    createLemmaLink: vi.fn(),
    findLemmaLinkById: vi.fn(),
    listLemmaLinksByJinyeId: vi.fn(),
    listActiveLemmaLinksForTarget: vi.fn(),
    updateLemmaLink: vi.fn(),
    deleteLemmaLink: vi.fn(),
    ...overrides,
  };
}

describe('UpdateJinyeCommentUseCase', () => {
  const audit = { record: vi.fn() };
  const blocklist = { listAllActiveWords: vi.fn(async () => []) };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('edit body milik sendiri + tulis revisi + audit', async () => {
    const updateRevision = vi.fn(async () =>
      makeComment({ body: 'komen baru', isEdited: true }),
    );
    const repo = emptyRepo({ updateCommentWithRevision: updateRevision });
    const uc = new UpdateJinyeCommentUseCase(repo, audit as never, blocklist);

    const out = await uc.execute({
      jinyeId: JINYE_ID,
      commentId: COMMENT_ID,
      userId: ACTOR,
      body: 'komen baru',
    });

    expect(out.body).toBe('komen baru');
    expect(updateRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        commentId: COMMENT_ID,
        editorId: ACTOR,
        body: 'komen baru',
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        entityType: 'jinye_comment',
        entityId: COMMENT_ID,
      }),
    );
    expect(repo.markCommentLemmaLinksStale).toHaveBeenCalledWith(COMMENT_ID);
  });

  it('non-owner → 403', async () => {
    const repo = emptyRepo();
    const uc = new UpdateJinyeCommentUseCase(repo, audit as never, blocklist);
    await expect(
      uc.execute({
        jinyeId: JINYE_ID,
        commentId: COMMENT_ID,
        userId: OTHER,
        body: 'hack',
      }),
    ).rejects.toMatchObject({ errorCode: 'FORBIDDEN' });
    expect(repo.updateCommentWithRevision).not.toHaveBeenCalled();
  });

  it('non-published → 404', async () => {
    const repo = emptyRepo({
      findCommentById: vi.fn(async () =>
        makeComment({ status: 'deleted_by_author' }),
      ),
    });
    const uc = new UpdateJinyeCommentUseCase(repo, audit as never, blocklist);
    await expect(
      uc.execute({
        jinyeId: JINYE_ID,
        commentId: COMMENT_ID,
        userId: ACTOR,
        body: 'x',
      }),
    ).rejects.toMatchObject({ errorCode: 'JINYE_COMMENT_NOT_FOUND' });
  });

  it('body kosong tanpa gambar → 400', async () => {
    const repo = emptyRepo();
    const uc = new UpdateJinyeCommentUseCase(repo, audit as never, blocklist);
    await expect(
      uc.execute({
        jinyeId: JINYE_ID,
        commentId: COMMENT_ID,
        userId: ACTOR,
        body: '   ',
      }),
    ).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
  });
});

describe('GetJinyeCommentEditHistoryUseCase', () => {
  it('return current + revisions', async () => {
    const repo = emptyRepo({
      findCommentById: vi.fn(async () =>
        makeComment({ body: 'sekarang', isEdited: true }),
      ),
      listCommentRevisions: vi.fn(async () => [
        {
          id: '01REV',
          commentId: COMMENT_ID,
          editorId: ACTOR,
          body: 'lama',
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
      ]),
    });
    const uc = new GetJinyeCommentEditHistoryUseCase(repo);
    const out = await uc.execute({ jinyeId: JINYE_ID, commentId: COMMENT_ID });
    expect(out.current.body).toBe('sekarang');
    expect(out.current.is_edited).toBe(true);
    expect(out.revisions).toHaveLength(1);
    expect(out.revisions[0]?.body).toBe('lama');
  });

  it('deleted → 404', async () => {
    const repo = emptyRepo({
      findCommentById: vi.fn(async () =>
        makeComment({ status: 'deleted_by_author' }),
      ),
    });
    const uc = new GetJinyeCommentEditHistoryUseCase(repo);
    await expect(
      uc.execute({ jinyeId: JINYE_ID, commentId: COMMENT_ID }),
    ).rejects.toMatchObject({ errorCode: 'JINYE_COMMENT_NOT_FOUND' });
  });
});

describe('DeleteJinyeCommentUseCase', () => {
  const audit = { record: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('author delete → deleted_by_author + decrement count', async () => {
    const repo = emptyRepo({
      markCommentDeletedByAuthor: vi.fn(async () => true),
      incrementPublishedCommentCount: vi.fn(),
    });
    const uc = new DeleteJinyeCommentUseCase(repo, audit as never);
    await uc.execute({ id: COMMENT_ID, userId: ACTOR });
    expect(repo.markCommentDeletedByAuthor).toHaveBeenCalledWith(
      COMMENT_ID,
      ACTOR,
    );
    expect(repo.incrementPublishedCommentCount).toHaveBeenCalledWith(
      JINYE_ID,
      -1,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'delete',
        entityType: 'jinye_comment',
      }),
    );
  });

  it('non-owner → 403', async () => {
    const repo = emptyRepo();
    const uc = new DeleteJinyeCommentUseCase(repo, audit as never);
    await expect(
      uc.execute({ id: COMMENT_ID, userId: OTHER }),
    ).rejects.toMatchObject({ errorCode: 'FORBIDDEN' });
  });
});
