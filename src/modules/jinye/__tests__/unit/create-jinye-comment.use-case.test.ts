import { describe, expect, it, vi } from 'vitest';
import { NotFoundError, ValidationError } from '@/shared/errors/app-error';
import { CreateJinyeCommentUseCase } from '../../application/use-cases/create-jinye-comment.use-case';
import type { Jinye, JinyeComment } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

vi.mock('@/modules/word/application/utils/assert-can-contribute', () => ({
  assertCanContribute: vi.fn(async () => undefined),
}));

vi.mock('@/shared/moderation/assert-ugc-text-quality-with-strike', () => ({
  assertUgcTextQualityWithStrike: vi.fn(async (text: string) => text),
}));

vi.mock(
  '@/modules/comment-blocklist/application/utils/apply-blocklist-filter',
  () => ({
    applyBlocklistFilter: vi.fn((text: string) => text),
  }),
);

const ACTOR = '01ACTORJINYE00000000000000';
const JINYE_ID = '01JINYE0000000000000000001';

function makeJinye(): Jinye {
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
    publishedCommentCount: 0,
    repostCount: 0,
    createdAt: new Date(),
    updatedAt: null,
  };
}

function makeComment(overrides: Partial<JinyeComment> = {}): JinyeComment {
  return {
    id: '01JINYECOMMENT000000000001',
    jinyeId: JINYE_ID,
    parentId: null,
    userId: ACTOR,
    username: 'aji',
    displayName: 'Aji',
    avatarUrl: null,
    userRole: 'contributor',
    body: 'komen',
    bodyOriginal: null,
    images: [],
    status: 'published',
    createdAt: new Date(),
    updatedAt: null,
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
    findPlainRepostByUser: vi.fn(),
    adjustRepostCount: vi.fn(),
    markDeletedByAuthor: vi.fn(),
    setAudio: vi.fn(),
    createComment: vi.fn(async () => makeComment()),
    findCommentById: vi.fn(),
    listCommentsByJinyeId: vi.fn(),
    markCommentDeletedByAuthor: vi.fn(),
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
    createTranslation: vi.fn(),
    findTranslationById: vi.fn(),
    listTranslationsByJinyeId: vi.fn(),
    findPendingTranslationByTranslator: vi.fn(),
    findAcceptedTranslation: vi.fn(),
    updateTranslation: vi.fn(),
    rejectPendingTranslations: vi.fn(),
    ...overrides,
  };
}

describe('CreateJinyeCommentUseCase', () => {
  it('404 jika jinye tidak published', async () => {
    const repo = emptyRepo({
      findById: vi.fn(async () => null),
    });
    const uc = new CreateJinyeCommentUseCase(
      repo,
      { record: vi.fn() } as never,
      { listAllActiveWords: vi.fn(async () => []) },
    );
    await expect(
      uc.execute({ jinyeId: JINYE_ID, userId: ACTOR, body: 'hai' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('menolak reply ke reply (lebih dari 1 level)', async () => {
    const parent = makeComment({
      id: '01PARENT000000000000000001',
      parentId: '01GRAND000000000000000001',
    });
    const repo = emptyRepo({
      findCommentById: vi.fn(async () => parent),
    });
    const uc = new CreateJinyeCommentUseCase(
      repo,
      { record: vi.fn() } as never,
      { listAllActiveWords: vi.fn(async () => []) },
    );
    await expect(
      uc.execute({
        jinyeId: JINYE_ID,
        userId: ACTOR,
        body: 'reply',
        parentId: parent.id,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('menyimpan komen top-level + activity', async () => {
    const created = makeComment({ body: 'halo juga' });
    const activity = { safe: vi.fn(async () => undefined) };
    const repo = emptyRepo({
      createComment: vi.fn(async () => created),
    });
    const uc = new CreateJinyeCommentUseCase(
      repo,
      { record: vi.fn(async () => undefined) } as never,
      { listAllActiveWords: vi.fn(async () => []) },
      undefined,
      activity,
    );
    const out = await uc.execute({
      jinyeId: JINYE_ID,
      userId: ACTOR,
      body: 'halo juga',
    });
    expect(out.body).toBe('halo juga');
    expect(repo.incrementPublishedCommentCount).toHaveBeenCalledWith(JINYE_ID, 1);
    expect(activity.safe).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'jinye_comment_created' }),
    );
  });

  it('notifikasi ke owner Jinye (skip self)', async () => {
    const OWNER = '01OWNERJINYE0000000000000';
    const COMMENTER = '01COMMENTER00000000000000';
    const created = makeComment({ userId: COMMENTER, body: 'asal' });
    const inbox = { execute: vi.fn(async () => undefined) };
    const notify = { execute: vi.fn(async () => undefined) };
    const repo = emptyRepo({
      findById: vi.fn(async () => ({ ...makeJinye(), userId: OWNER })),
      createComment: vi.fn(async () => created),
    });
    const uc = new CreateJinyeCommentUseCase(
      repo,
      { record: vi.fn(async () => undefined) } as never,
      { listAllActiveWords: vi.fn(async () => []) },
      undefined,
      undefined,
      {
        findById: vi.fn(async () => ({
          displayName: 'Citra',
          username: 'citra',
        })),
      } as never,
      inbox as never,
      notify as never,
    );
    await uc.execute({
      jinyeId: JINYE_ID,
      userId: COMMENTER,
      body: 'asal',
    });
    expect(inbox.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: OWNER,
        type: 'jinye_comment',
        actionKind: 'jinye',
        actionValue: JINYE_ID,
      }),
    );
    expect(notify.execute).toHaveBeenCalledWith(
      expect.objectContaining({ userId: OWNER }),
    );
  });
});
