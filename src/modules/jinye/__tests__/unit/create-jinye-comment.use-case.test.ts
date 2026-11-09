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
    markDeletedByAuthor: vi.fn(),
    setAudio: vi.fn(),
    createComment: vi.fn(async () => makeComment()),
    findCommentById: vi.fn(),
    listCommentsByJinyeId: vi.fn(),
    markCommentDeletedByAuthor: vi.fn(),
    incrementPublishedCommentCount: vi.fn(),
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
});
