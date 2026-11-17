import { describe, expect, it, vi } from 'vitest';
import { NotFoundError, ValidationError } from '@/shared/errors/app-error';
import { CreateKaryaLemmaLinkUseCase } from '../../application/use-cases/create-karya-lemma-link.use-case';
import type { KaryaLemmaLink } from '../../domain/karya';
import type { KaryaRepositoryImpl } from '../../infrastructure/karya.repository.impl';
import { assertExcerptLemmaEligible } from '../../application/utils/assert-excerpt-lemma-eligible';

vi.mock('@/modules/word/application/utils/assert-can-contribute', () => ({
  assertCanContribute: vi.fn(async () => undefined),
}));

const AUTHOR = '01AUTHOR000000000000000001';
const EXCERPT_ID = '01EXCERPT000000000000001';
const WORD_ID = '01WORD00000000000000000001';

function makeLink(): KaryaLemmaLink {
  return {
    id: '01LINK00000000000000000001',
    excerptId: EXCERPT_ID,
    start: 0,
    end: 4,
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
  };
}

function publishedCtx() {
  return {
    id: EXCERPT_ID,
    text: 'makan nasi',
    publishStatus: 'published',
    deletedAt: null,
    rightsStatus: 'fair_quote' as const,
    authorId: AUTHOR,
    karyaId: '01KARYA000000000000000001',
    karyaPublishStatus: 'published',
    karyaDeletedAt: null,
  };
}

function repo(overrides: Partial<KaryaRepositoryImpl> = {}): KaryaRepositoryImpl {
  return {
    findExcerptLemmaContext: vi.fn(async () => publishedCtx()),
    listActiveLemmaLinksForExcerpt: vi.fn(async () => []),
    createLemmaLink: vi.fn(async () => makeLink()),
    ...overrides,
  } as unknown as KaryaRepositoryImpl;
}

describe('assertExcerptLemmaEligible', () => {
  it('unknown rights → ValidationError', () => {
    expect(() =>
      assertExcerptLemmaEligible({
        ...publishedCtx(),
        rightsStatus: 'unknown',
      }),
    ).toThrow(ValidationError);
  });

  it('draft excerpt → NotFound', () => {
    expect(() =>
      assertExcerptLemmaEligible({
        ...publishedCtx(),
        publishStatus: 'draft',
      }),
    ).toThrow(NotFoundError);
  });
});

describe('CreateKaryaLemmaLinkUseCase', () => {
  const audit = { record: vi.fn(async () => undefined) };

  it('author match → source author', async () => {
    const r = repo();
    const words = { findById: vi.fn(async () => ({ status: 'published', isVerified: true, deletedAt: null })) };
    await new CreateKaryaLemmaLinkUseCase(r, words as never, audit as never).execute({
      excerptId: EXCERPT_ID,
      userId: AUTHOR,
      start: 0,
      end: 4,
      wordId: WORD_ID,
    });
    expect(r.createLemmaLink).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'author' }),
    );
  });

  it('unknown rights gate di create', async () => {
    const r = repo({
      findExcerptLemmaContext: vi.fn(async () => ({
        ...publishedCtx(),
        rightsStatus: 'unknown' as const,
      })),
    });
    await expect(
      new CreateKaryaLemmaLinkUseCase(
        r,
        { findById: vi.fn() } as never,
        audit as never,
      ).execute({
        excerptId: EXCERPT_ID,
        userId: AUTHOR,
        start: 0,
        end: 4,
        wordId: WORD_ID,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});