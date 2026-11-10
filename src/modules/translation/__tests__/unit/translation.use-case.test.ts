import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateTranslationUseCase } from '../../application/use-cases/create-translation.use-case';
import { ResolveTranslationUseCase } from '../../application/use-cases/resolve-translation.use-case';

vi.mock('@/modules/word/application/utils/assert-can-contribute', () => ({
  assertCanContribute: vi.fn().mockResolvedValue(undefined),
}));

const jinyeBase = {
  id: '01JINYE0000000000000000001',
  userId: '01USER00000000000000000001',
  username: 'ali',
  displayName: 'Ali',
  avatarUrl: null,
  userRole: 'contributor',
  body: 'Aku makatn nasi',
  bodyOriginal: null,
  images: [],
  audio: null,
  repostOfId: null,
  quoteBody: null,
  status: 'published' as const,
  publishedCommentCount: 0,
  repostCount: 0,
  createdAt: new Date(),
  updatedAt: null,
};

describe('CreateTranslationUseCase', () => {
  const translationRepo = {
    findPendingByTranslator: vi.fn(),
    create: vi.fn(),
  };
  const jinyeRepo = {
    findById: vi.fn(),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    vi.clearAllMocks();
    jinyeRepo.findById.mockResolvedValue(jinyeBase);
    translationRepo.findPendingByTranslator.mockResolvedValue(null);
    translationRepo.create.mockResolvedValue({
      id: '01TR0000000000000000000001',
      reff: 'jinye',
      reffId: jinyeBase.id,
      body: 'Saya makan nasi',
      status: 'pending',
      translatorId: '01USER00000000000000000002',
      reviewedBy: null,
      reviewedAt: null,
      createdAt: new Date(),
      updatedAt: null,
    });
  });

  it('creates pending translation', async () => {
    const row = await new CreateTranslationUseCase(
      translationRepo as never,
      jinyeRepo as never,
      audit as never,
    ).execute({
      reff: 'jinye',
      reffId: jinyeBase.id,
      body: 'Saya makan nasi',
      translatorId: '01USER00000000000000000002',
    });
    expect(row.status).toBe('pending');
    expect(translationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        reff: 'jinye',
        reffId: jinyeBase.id,
        body: 'Saya makan nasi',
      }),
    );
  });

  it('rejects second pending for same translator', async () => {
    translationRepo.findPendingByTranslator.mockResolvedValue({
      id: '01TROLD',
      status: 'pending',
    });
    await expect(
      new CreateTranslationUseCase(
        translationRepo as never,
        jinyeRepo as never,
        audit as never,
      ).execute({
        reff: 'jinye',
        reffId: jinyeBase.id,
        body: 'Lain',
        translatorId: '01USER00000000000000000002',
      }),
    ).rejects.toMatchObject({ errorCode: 'TRANSLATION_PENDING' });
  });
});

describe('ResolveTranslationUseCase', () => {
  const translationRepo = {
    findById: vi.fn(),
    findAccepted: vi.fn(),
    updateStatus: vi.fn(),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('approves and supersedes previous accepted', async () => {
    translationRepo.findById.mockResolvedValue({
      id: '01TR0000000000000000000001',
      reff: 'jinye',
      reffId: jinyeBase.id,
      body: 'Saya makan nasi',
      status: 'pending',
      translatorId: '01USER00000000000000000002',
      reviewedBy: null,
      reviewedAt: null,
      createdAt: new Date(),
      updatedAt: null,
    });
    translationRepo.findAccepted.mockResolvedValue({
      id: '01TROLD0000000000000000001',
      reff: 'jinye',
      reffId: jinyeBase.id,
      body: 'lama',
      status: 'accepted',
      translatorId: '01USER00000000000000000003',
      reviewedBy: null,
      reviewedAt: null,
      createdAt: new Date(),
      updatedAt: null,
    });
    translationRepo.updateStatus.mockImplementation(
      async (id: string, status: string, reviewedBy: string) => ({
        id,
        reff: 'jinye',
        reffId: jinyeBase.id,
        body: 'Saya makan nasi',
        status,
        translatorId: '01USER00000000000000000002',
        reviewedBy,
        reviewedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const out = await new ResolveTranslationUseCase(
      translationRepo as never,
      audit as never,
    ).execute({
      id: '01TR0000000000000000000001',
      action: 'approve',
      reviewerId: '01VER0000000000000000000001',
    });

    expect(translationRepo.updateStatus).toHaveBeenCalledWith(
      '01TROLD0000000000000000001',
      'rejected',
      '01VER0000000000000000000001',
    );
    expect(out.status).toBe('accepted');
  });
});
