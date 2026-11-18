import { describe, expect, it, vi } from 'vitest';
import { NotFoundError, ValidationError } from '@/shared/errors/app-error';
import { CreateJinyeLemmaLinkUseCase } from '../../application/use-cases/create-jinye-lemma-link.use-case';
import { ProposeJinyeLemmaCorrectionUseCase } from '../../application/use-cases/propose-jinye-lemma-correction.use-case';
import { ResolveJinyeLemmaCorrectionUseCase } from '../../application/use-cases/resolve-jinye-lemma-correction.use-case';
import type {
  Jinye,
  JinyeComment,
  JinyeLemmaLink,
} from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

vi.mock('@/modules/word/application/utils/assert-can-contribute', () => ({
  assertCanContribute: vi.fn(async () => undefined),
}));

const OWNER = '01OWNERJINYE0000000000000';
const OTHER = '01OTHERJINYE0000000000000';
const COMMENT_AUTHOR = '01COMMENTAUTHOR0000000000';
const JINYE_ID = '01JINYE0000000000000000001';
const COMMENT_ID = '01JINYECOMMENT000000000001';
const WORD_ID = '01WORD00000000000000000001';
const WORD2 = '01WORD00000000000000000002';

function makeJinye(): Jinye {
  return {
    id: JINYE_ID,
    userId: OWNER,
    username: 'aji',
    displayName: 'Aji',
    avatarUrl: null,
    userRole: null,
    body: 'Aku makan nasi',
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

function makeLink(overrides: Partial<JinyeLemmaLink> = {}): JinyeLemmaLink {
  return {
    id: '01LINK00000000000000000001',
    jinyeId: JINYE_ID,
    commentId: null,
    start: 4,
    end: 9,
    wordId: WORD_ID,
    lemma: 'makan',
    status: 'active',
    source: 'author',
    proposedWordId: null,
    proposedLemma: null,
    proposedBy: null,
    reviewedBy: null,
    reviewedAt: null,
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
    userId: COMMENT_AUTHOR,
    username: 'budi',
    displayName: 'Budi',
    avatarUrl: null,
    userRole: null,
    body: 'Aku makan nasi',
    bodyOriginal: null,
    stickerId: null,
    images: [],
    status: 'published',
    createdAt: new Date(),
    updatedAt: null,
    ...overrides,
  };
}

function repo(overrides: Partial<JinyeRepository> = {}): JinyeRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(async () => makeJinye()),
    list: vi.fn(),
    findLatestCreatedAtByUser: vi.fn(),
    findLatestQuotaConsumingCreatedAtByUser: vi.fn(),
    updateBody: vi.fn(),
    listRevisions: vi.fn(),
    markLemmaLinksStale: vi.fn(),
    markCommentLemmaLinksStale: vi.fn(),
    findPlainRepostByUser: vi.fn(),
    adjustRepostCount: vi.fn(),
    markDeletedByAuthor: vi.fn(),
    takedown: vi.fn(),
    setAudio: vi.fn(),
    setStatus: vi.fn(),
    getPinnedJinyeId: vi.fn(),
    setPinnedJinyeId: vi.fn(),
    clearPinnedIf: vi.fn(),
    createComment: vi.fn(),
    findCommentById: vi.fn(),
    listCommentsByJinyeId: vi.fn(),
    updateCommentWithRevision: vi.fn(),
    listCommentRevisions: vi.fn(),
    markCommentDeletedByAuthor: vi.fn(),
    takedownComment: vi.fn(),
    incrementPublishedCommentCount: vi.fn(),
    createLemmaLink: vi.fn(async () => makeLink()),
    findLemmaLinkById: vi.fn(async () => makeLink()),
    listLemmaLinksByJinyeId: vi.fn(async () => []),
    listActiveLemmaLinksForTarget: vi.fn(async () => []),
    updateLemmaLink: vi.fn(async () => makeLink({ status: 'pending_correction' })),
    deleteLemmaLink: vi.fn(async () => true),
    ...overrides,
  };
}

const words = {
  findById: vi.fn(async (id: string) => ({
    id,
    status: 'published',
    isVerified: true,
    deletedAt: null,
    lemma: id === WORD2 ? 'nasi' : 'makan',
  })),
};

const audit = { record: vi.fn(async () => undefined) } as never;

describe('Jinye lemma links', () => {
  it('create: non-owner → source community', async () => {
    const r = repo();
    const out = await new CreateJinyeLemmaLinkUseCase(
      r,
      words as never,
      audit,
    ).execute({
      jinyeId: JINYE_ID,
      userId: OTHER,
      start: 4,
      end: 9,
      wordId: WORD_ID,
    });
    expect(out.lemma).toBe('makan');
    expect(r.createLemmaLink).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'community',
        status: 'active',
        wordId: WORD_ID,
      }),
    );
  });

  it('create: span invalid → ValidationError', async () => {
    await expect(
      new CreateJinyeLemmaLinkUseCase(repo(), words as never, audit).execute({
        jinyeId: JINYE_ID,
        userId: OWNER,
        start: 0,
        end: 99,
        wordId: WORD_ID,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('create: owner + span valid → source author', async () => {
    const r = repo();
    const out = await new CreateJinyeLemmaLinkUseCase(
      r,
      words as never,
      audit,
    ).execute({
      jinyeId: JINYE_ID,
      userId: OWNER,
      start: 4,
      end: 9,
      wordId: WORD_ID,
    });
    expect(out.lemma).toBe('makan');
    expect(r.createLemmaLink).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'author',
        status: 'active',
        wordId: WORD_ID,
        commentId: null,
      }),
    );
    expect(r.listActiveLemmaLinksForTarget).toHaveBeenCalledWith({
      jinyeId: JINYE_ID,
    });
  });

  it('create: span di komentar → commentId + source author komentar', async () => {
    const COMMENT_ID = '01COMMENT00000000000000001';
    const r = repo({
      findCommentById: vi.fn(async () => ({
        id: COMMENT_ID,
        jinyeId: JINYE_ID,
        parentId: null,
        userId: OTHER,
        username: 'budi',
        displayName: 'Budi',
        avatarUrl: null,
        userRole: null,
        body: 'enak sekali',
        bodyOriginal: null,
        stickerId: null,
        images: [],
        status: 'published' as const,
        createdAt: new Date(),
        updatedAt: null,
      })),
      createLemmaLink: vi.fn(async () =>
        makeLink({
          commentId: COMMENT_ID,
          start: 0,
          end: 4,
          source: 'author',
          lemma: 'enak',
        }),
      ),
    });
    await new CreateJinyeLemmaLinkUseCase(r, words as never, audit).execute({
      jinyeId: JINYE_ID,
      userId: OTHER,
      start: 0,
      end: 4,
      wordId: WORD_ID,
      commentId: COMMENT_ID,
    });
    expect(r.createLemmaLink).toHaveBeenCalledWith(
      expect.objectContaining({
        jinyeId: JINYE_ID,
        commentId: COMMENT_ID,
        source: 'author',
        start: 0,
        end: 4,
      }),
    );
    expect(r.listActiveLemmaLinksForTarget).toHaveBeenCalledWith({
      commentId: COMMENT_ID,
    });
  });

  it('create: comment_id tidak valid → NotFoundError', async () => {
    await expect(
      new CreateJinyeLemmaLinkUseCase(
        repo({ findCommentById: vi.fn(async () => null) }),
        words as never,
        audit,
      ).execute({
        jinyeId: JINYE_ID,
        userId: OWNER,
        start: 0,
        end: 4,
        wordId: WORD_ID,
        commentId: '01MISSINGCOMMENT0000000000',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('create: comment span → source from comment author + scoped list', async () => {
    const r = repo({
      findCommentById: vi.fn(async () => makeComment()),
      createLemmaLink: vi.fn(async () =>
        makeLink({ commentId: COMMENT_ID, source: 'author' }),
      ),
    });
    await new CreateJinyeLemmaLinkUseCase(r, words as never, audit).execute({
      jinyeId: JINYE_ID,
      userId: COMMENT_AUTHOR,
      commentId: COMMENT_ID,
      start: 4,
      end: 9,
      wordId: WORD_ID,
    });
    expect(r.listActiveLemmaLinksForTarget).toHaveBeenCalledWith({
      commentId: COMMENT_ID,
    });
    expect(r.createLemmaLink).toHaveBeenCalledWith(
      expect.objectContaining({
        jinyeId: JINYE_ID,
        commentId: COMMENT_ID,
        source: 'author',
        status: 'active',
        wordId: WORD_ID,
      }),
    );
  });

  it('create: invalid comment → NotFoundError', async () => {
    const r = repo({
      findCommentById: vi.fn(async () => null),
    });
    await expect(
      new CreateJinyeLemmaLinkUseCase(r, words as never, audit).execute({
        jinyeId: JINYE_ID,
        userId: OWNER,
        commentId: COMMENT_ID,
        start: 4,
        end: 9,
        wordId: WORD_ID,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(r.createLemmaLink).not.toHaveBeenCalled();
  });

  it('propose correction → pending_correction', async () => {
    const r = repo();
    await new ProposeJinyeLemmaCorrectionUseCase(
      r,
      words as never,
      audit,
    ).execute({
      jinyeId: JINYE_ID,
      linkId: '01LINK00000000000000000001',
      userId: OTHER,
      wordId: WORD2,
    });
    expect(r.updateLemmaLink).toHaveBeenCalledWith(
      '01LINK00000000000000000001',
      expect.objectContaining({
        status: 'pending_correction',
        proposedWordId: WORD2,
      }),
    );
  });

  it('resolve approve → word diganti', async () => {
    const r = repo({
      findLemmaLinkById: vi.fn(async () =>
        makeLink({
          status: 'pending_correction',
          proposedWordId: WORD2,
        }),
      ),
      updateLemmaLink: vi.fn(async () =>
        makeLink({ wordId: WORD2, status: 'active', proposedWordId: null }),
      ),
    });
    const out = await new ResolveJinyeLemmaCorrectionUseCase(r, audit).execute({
      jinyeId: JINYE_ID,
      linkId: '01LINK00000000000000000001',
      reviewerId: OWNER,
      action: 'approve',
    });
    expect(out.wordId).toBe(WORD2);
  });
});
