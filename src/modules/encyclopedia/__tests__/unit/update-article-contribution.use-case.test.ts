import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateArticleContributionUseCase } from '../../application/use-cases/encyclopedia-contribution.use-cases';
import { ConflictError, NotFoundError } from '@/shared/errors/app-error';

vi.mock('@/modules/word/application/utils/assert-can-contribute', () => ({
  assertCanContribute: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/shared/moderation/assert-ugc-text-quality-with-strike', () => ({
  assertUgcTextQualityWithStrike: vi.fn().mockResolvedValue(undefined),
}));

const USER = '01USERULID000000000000001';
const CONTRIB = '01CONTRIBULID00000000001';

const payload = {
  title: 'Judul Baru',
  excerpt: '',
  body_md: 'Isi diperbarui cukup panjang.',
  category_id: 'sejarah',
  tags: ['istana'],
  source_url: 'https://example.com/sumber',
};

function makeExisting(status: 'pending' | 'needs_revision' | 'approved' | 'rejected') {
  return {
    id: CONTRIB,
    userId: USER,
    kind: 'new' as const,
    articleId: null,
    status,
    payload: {
      title: 'Lama',
      excerpt: '',
      body_md: 'Lama',
      category_id: 'sejarah',
      tags: [],
    },
  };
}

describe('UpdateArticleContributionUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pending: update payload in-place tanpa reset status', async () => {
    const existing = makeExisting('pending');
    const updated = { ...existing, payload, status: 'pending' as const };
    const repo = {
      findContributionById: vi.fn().mockResolvedValue(existing),
      updateContributionPayload: vi.fn().mockResolvedValue(updated),
    };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const uc = new UpdateArticleContributionUseCase(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      repo as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      audit as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
    );

    const result = await uc.execute({
      contributionId: CONTRIB,
      userId: USER,
      payload,
    });

    expect(repo.updateContributionPayload).toHaveBeenCalledWith({
      id: CONTRIB,
      payload,
      resetToPending: false,
    });
    expect(result.status).toBe('pending');
    expect(audit.record).toHaveBeenCalled();
  });

  it('needs_revision: update + reset ke pending', async () => {
    const existing = makeExisting('needs_revision');
    const updated = { ...existing, payload, status: 'pending' as const };
    const repo = {
      findContributionById: vi.fn().mockResolvedValue(existing),
      updateContributionPayload: vi.fn().mockResolvedValue(updated),
    };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const uc = new UpdateArticleContributionUseCase(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      repo as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      audit as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
    );

    await uc.execute({
      contributionId: CONTRIB,
      userId: USER,
      payload,
    });

    expect(repo.updateContributionPayload).toHaveBeenCalledWith({
      id: CONTRIB,
      payload,
      resetToPending: true,
    });
  });

  it('approved: 409 CONTRIBUTION_NOT_EDITABLE', async () => {
    const repo = {
      findContributionById: vi.fn().mockResolvedValue(makeExisting('approved')),
      updateContributionPayload: vi.fn(),
    };
    const uc = new UpdateArticleContributionUseCase(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      repo as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { record: vi.fn() } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
    );

    await expect(
      uc.execute({ contributionId: CONTRIB, userId: USER, payload }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(repo.updateContributionPayload).not.toHaveBeenCalled();
  });

  it('bukan pemilik: 404', async () => {
    const repo = {
      findContributionById: vi
        .fn()
        .mockResolvedValue({ ...makeExisting('pending'), userId: 'other' }),
      updateContributionPayload: vi.fn(),
    };
    const uc = new UpdateArticleContributionUseCase(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      repo as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { record: vi.fn() } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
    );

    await expect(
      uc.execute({ contributionId: CONTRIB, userId: USER, payload }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
