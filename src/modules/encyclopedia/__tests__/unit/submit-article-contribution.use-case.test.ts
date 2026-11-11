import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubmitArticleContributionUseCase } from '../../application/use-cases/encyclopedia-contribution.use-cases';

vi.mock('@/modules/word/application/utils/assert-can-contribute', () => ({
  assertCanContribute: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/shared/moderation/assert-ugc-text-quality-with-strike', () => ({
  assertUgcTextQualityWithStrike: vi.fn().mockResolvedValue(undefined),
}));

const NOW = new Date('2026-10-01T00:00:00Z');

const article = {
  id: '01ARTICLEULID000000000001',
  slug: 'sejarah-istana',
  title: 'Sejarah Istana',
  status: 'published' as const,
  updatedAt: NOW,
  createdAt: NOW,
};

function makeRepo(over: Record<string, ReturnType<typeof vi.fn>> = {}) {
  return {
    listCategories: vi.fn().mockResolvedValue([
      { id: 'sejarah', status: 'published' },
    ]),
    findById: vi.fn().mockResolvedValue(null),
    findBySlug: vi.fn().mockResolvedValue(null),
    hasActiveEditByOthers: vi.fn().mockResolvedValue(false),
    createContribution: vi.fn().mockImplementation(async (input) => ({
      id: '01CONTRIBULID00000000001',
      ...input,
      status: 'pending',
    })),
    ...over,
  };
}

function makeAudit() {
  return { record: vi.fn().mockResolvedValue(undefined) };
}

describe('SubmitArticleContributionUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('edit dengan slug: resolve ke ULID sebelum simpan', async () => {
    const repo = makeRepo({
      findBySlug: vi.fn().mockResolvedValue(article),
    });
    const audit = makeAudit();
    const uc = new SubmitArticleContributionUseCase(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      repo as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      audit as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
    );

    await uc.execute({
      userId: '01USERULID000000000000001',
      kind: 'edit',
      articleId: 'sejarah-istana',
      payload: {
        title: 'Sejarah Istana Diedit',
        excerpt: 'Ringkas.',
        body_md: 'Isi panjang cukup.',
        category_id: 'sejarah',
        tags: ['istana'],
      },
    });

    expect(repo.findById).toHaveBeenCalledWith('sejarah-istana');
    expect(repo.findBySlug).toHaveBeenCalledWith('sejarah-istana');
    expect(repo.createContribution).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'edit',
        articleId: '01ARTICLEULID000000000001',
      }),
    );
  });

  it('edit dengan ULID: tidak perlu slug lookup', async () => {
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(article),
    });
    const audit = makeAudit();
    const uc = new SubmitArticleContributionUseCase(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      repo as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      audit as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
    );

    await uc.execute({
      userId: '01USERULID000000000000001',
      kind: 'edit',
      articleId: article.id,
      payload: {
        title: 'Sejarah Istana',
        excerpt: 'Ringkas.',
        body_md: 'Isi.',
        category_id: 'sejarah',
        tags: [],
      },
    });

    expect(repo.findBySlug).not.toHaveBeenCalled();
    expect(repo.createContribution).toHaveBeenCalledWith(
      expect.objectContaining({ articleId: article.id }),
    );
  });
});
