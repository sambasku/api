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
    const inbox = {
      execute: vi.fn().mockResolvedValue(undefined),
      executeIfNew: vi.fn().mockResolvedValue(true),
    };
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

    expect(inbox.executeIfNew).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: AUTHOR,
        type: 'article_clap',
        targetKind: 'article',
        targetId: `${ARTICLE_ID}:${ACTOR}`,
        actorId: ACTOR,
        actionKind: 'article',
        actionValue: 'sejarah-istana',
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
    const inbox = {
      execute: vi.fn().mockResolvedValue(undefined),
      executeIfNew: vi.fn().mockResolvedValue(true),
    };
    const notifyUser = { execute: vi.fn().mockResolvedValue(undefined) };
    const uc = new SetArticleClapCountUseCase(
      repo,
      undefined,
      inbox as never,
      notifyUser as never,
    );

    await uc.execute(ACTOR, ARTICLE_ID, 2);

    expect(inbox.executeIfNew).not.toHaveBeenCalled();
    expect(notifyUser.execute).not.toHaveBeenCalled();
  });

  it('author clap sendiri → tidak notif', async () => {
    const repo = makeRepo();
    const inbox = {
      execute: vi.fn().mockResolvedValue(undefined),
      executeIfNew: vi.fn().mockResolvedValue(true),
    };
    const notifyUser = { execute: vi.fn().mockResolvedValue(undefined) };
    const uc = new SetArticleClapCountUseCase(
      repo,
      undefined,
      inbox as never,
      notifyUser as never,
    );

    await uc.execute(AUTHOR, ARTICLE_ID, 2);

    expect(inbox.executeIfNew).not.toHaveBeenCalled();
    expect(notifyUser.execute).not.toHaveBeenCalled();
  });

  it('clap kedua user yang sama (baris sudah ada) → tanpa push', async () => {
    const repo = makeRepo({
      getUserClapCount: vi.fn().mockResolvedValue(3),
      setClapCount: vi.fn().mockResolvedValue({ myCount: 5, clapTotal: 5 }),
    });
    const inbox = {
      executeIfNew: vi.fn().mockResolvedValue(false),
    };
    const notifyUser = { execute: vi.fn().mockResolvedValue(undefined) };
    const pushCooldown = {
      maySend: vi.fn().mockResolvedValue(true),
      touchAfterSend: vi.fn().mockResolvedValue(undefined),
    };
    const uc = new SetArticleClapCountUseCase(
      repo,
      undefined,
      inbox as never,
      notifyUser as never,
      pushCooldown as never,
    );

    await uc.execute(ACTOR, ARTICLE_ID, 5);

    expect(inbox.executeIfNew).toHaveBeenCalledTimes(1);
    expect(notifyUser.execute).not.toHaveBeenCalled();
    expect(pushCooldown.touchAfterSend).not.toHaveBeenCalled();
  });

  it('dua clapper berbeda → dua target_id inbox terpisah', async () => {
    const repo = makeRepo();
    const inbox = { executeIfNew: vi.fn().mockResolvedValue(true) };
    const notifyUser = { execute: vi.fn().mockResolvedValue(undefined) };
    const uc = new SetArticleClapCountUseCase(
      repo,
      undefined,
      inbox as never,
      notifyUser as never,
    );

    await uc.execute(ACTOR, ARTICLE_ID, 1);
    await uc.execute('01OTHERULID00000000000001', ARTICLE_ID, 1);

    const ids = inbox.executeIfNew.mock.calls.map(
      (c) => (c[0] as { targetId: string }).targetId,
    );
    expect(ids).toEqual([
      `${ARTICLE_ID}:${ACTOR}`,
      `${ARTICLE_ID}:01OTHERULID00000000000001`,
    ]);
  });
});
