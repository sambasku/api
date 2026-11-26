import { describe, it, expect, vi } from 'vitest';
import { SetArticleClapCountUseCase } from '../../application/use-cases/encyclopedia-contribution.use-cases';
import type { ArticleRepository } from '../../domain/repositories/encyclopedia.repository';
import type { Article } from '../../domain/entities/encyclopedia.entity';

const AUTHOR = '01AUTHORULID0000000000001';
const ACTOR = '01ACTORULID00000000000001';
const ARTICLE_ID = '01ARTICLEULID000000000001';

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: ARTICLE_ID,
    slug: 'sejarah-istana',
    title: 'Sejarah Istana',
    excerpt: 'Ringkas',
    bodyMd: 'Isi',
    bodyText: 'Isi',
    coverUrl: null,
    categoryId: 'cat1',
    categoryName: 'Sejarah',
    sourceUrl: null,
    referencesMd: null,
    authorUserId: AUTHOR,
    authorUsername: 'author',
    authorDisplayName: 'Author',
    authorAvatarUrl: null,
    authorDeletedAt: null,
    authorRole: null,
    status: 'published',
    tags: [],
    publishedAt: new Date('2026-01-01T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: null,
    ...overrides,
  };
}

function makeRepo(overrides: Partial<ArticleRepository> = {}) {
  return {
    articleTargetExists: vi.fn().mockResolvedValue(true),
    getUserClapCount: vi.fn().mockResolvedValue(0),
    setClapCount: vi.fn().mockResolvedValue({ myCount: 1, clapTotal: 1 }),
    findById: vi.fn().mockResolvedValue(makeArticle()),
    ...overrides,
  } as unknown as ArticleRepository;
}

describe('SetArticleClapCountUseCase notify', () => {
  it('clap naik → inbox + push ke author', async () => {
    const repo = makeRepo();
    const inbox = { execute: vi.fn().mockResolvedValue(undefined) };
    const notifyUser = { execute: vi.fn().mockResolvedValue(undefined) };
    const userRepo = {
      findById: vi.fn().mockResolvedValue({
        displayName: 'Siti',
        username: 'siti',
      }),
    };
    const pushCooldown = {
      maySend: vi.fn().mockResolvedValue(true),
      touchAfterSend: vi.fn().mockResolvedValue(undefined),
    };
    const uc = new SetArticleClapCountUseCase(
      repo,
      userRepo as never,
      inbox as never,
      notifyUser as never,
      pushCooldown as never,
    );

    await uc.execute(ACTOR, ARTICLE_ID, 3);

    expect(inbox.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: AUTHOR,
        type: 'article_clap',
        targetKind: 'article',
        targetId: ARTICLE_ID,
        actorId: ACTOR,
        actionKind: 'article',
        actionValue: 'sejarah-istana',
        refreshOnConflict: true,
      }),
    );
    expect(notifyUser.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: AUTHOR,
        data: expect.objectContaining({
          type: 'article_clap',
          action_kind: 'article',
          action_value: 'sejarah-istana',
        }),
      }),
    );
    expect(pushCooldown.touchAfterSend).toHaveBeenCalledWith(AUTHOR);
  });

  it('clap turun atau sama → tidak notif', async () => {
    const repo = makeRepo({
      getUserClapCount: vi.fn().mockResolvedValue(5),
      setClapCount: vi.fn().mockResolvedValue({ myCount: 2, clapTotal: 2 }),
    });
    const inbox = { execute: vi.fn().mockResolvedValue(undefined) };
    const notifyUser = { execute: vi.fn().mockResolvedValue(undefined) };
    const uc = new SetArticleClapCountUseCase(
      repo,
      undefined,
      inbox as never,
      notifyUser as never,
    );

    await uc.execute(ACTOR, ARTICLE_ID, 2);

    expect(inbox.execute).not.toHaveBeenCalled();
    expect(notifyUser.execute).not.toHaveBeenCalled();
  });

  it('author clap sendiri → tidak notif', async () => {
    const repo = makeRepo();
    const inbox = { execute: vi.fn().mockResolvedValue(undefined) };
    const notifyUser = { execute: vi.fn().mockResolvedValue(undefined) };
    const uc = new SetArticleClapCountUseCase(
      repo,
      undefined,
      inbox as never,
      notifyUser as never,
    );

    await uc.execute(AUTHOR, ARTICLE_ID, 2);

    expect(inbox.execute).not.toHaveBeenCalled();
    expect(notifyUser.execute).not.toHaveBeenCalled();
  });
});
