import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateTranslationUseCase } from '../../application/use-cases/create-translation.use-case';
import { ListTranslationsUseCase } from '../../application/use-cases/list-translations.use-case';
import { ResolveTranslationUseCase } from '../../application/use-cases/resolve-translation.use-case';
import { BadRequestError } from '@/shared/errors/app-error';

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
  const words = {
    findExampleById: vi.fn(),
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
      sourceBody: jinyeBase.body,
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
      words as never,
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
        sourceBody: jinyeBase.body,
        body: 'Saya makan nasi',
      }),
    );
  });

  it('creates pending for lemma_example', async () => {
    words.findExampleById.mockResolvedValue({
      id: '01EX0000000000000000000001',
      sourceSentence: 'Ia makatn nasi',
      targetSentence: null,
      status: 'published',
    });
    translationRepo.create.mockResolvedValue({
      id: '01TR0000000000000000000002',
      reff: 'lemma_example',
      reffId: '01EX0000000000000000000001',
      sourceBody: 'Ia makatn nasi',
      body: 'Dia makan nasi',
      status: 'pending',
      translatorId: '01USER00000000000000000002',
      reviewedBy: null,
      reviewedAt: null,
      createdAt: new Date(),
      updatedAt: null,
    });
    await new CreateTranslationUseCase(
      translationRepo as never,
      jinyeRepo as never,
      audit as never,
      words as never,
    ).execute({
      reff: 'lemma_example',
      reffId: '01EX0000000000000000000001',
      body: 'Dia makan nasi',
      translatorId: '01USER00000000000000000002',
    });
    expect(translationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        reff: 'lemma_example',
        sourceBody: 'Ia makatn nasi',
        body: 'Dia makan nasi',
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
        words as never,
      ).execute({
        reff: 'jinye',
        reffId: jinyeBase.id,
        body: 'Lain',
        translatorId: '01USER00000000000000000002',
      }),
    ).rejects.toMatchObject({ errorCode: 'TRANSLATION_PENDING' });
  });
});

describe('ListTranslationsUseCase', () => {
  const translationRepo = {
    list: vi.fn().mockResolvedValue([]),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('antrian global: reff + status tanpa reffId', async () => {
    await new ListTranslationsUseCase(translationRepo as never).execute({
      reff: 'jinye',
      status: 'pending',
    });
    expect(translationRepo.list).toHaveBeenCalledWith(
      expect.objectContaining({
        reff: 'jinye',
        status: 'pending',
        reffId: undefined,
      }),
    );
  });

  it('tanpa reffId dan tanpa status → BadRequest', async () => {
    await expect(
      new ListTranslationsUseCase(translationRepo as never).execute({
        reff: 'jinye',
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});

describe('ResolveTranslationUseCase', () => {
  const translationRepo = {
    findById: vi.fn(),
    findAccepted: vi.fn(),
    updateStatus: vi.fn(),
  };
  const words = {
    findExampleById: vi.fn(),
    applyExampleTargetSentence: vi.fn(),
    findLanguageIdByCode: vi.fn(),
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
      sourceBody: jinyeBase.body,
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
      sourceBody: jinyeBase.body,
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
        sourceBody: jinyeBase.body,
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
      words as never,
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
    expect(words.applyExampleTargetSentence).not.toHaveBeenCalled();
  });

  it('approve lemma_example menulis target_sentence ke examples', async () => {
    translationRepo.findById.mockResolvedValue({
      id: '01TR0000000000000000000003',
      reff: 'lemma_example',
      reffId: '01EX0000000000000000000001',
      sourceBody: 'Ia makatn nasi',
      body: 'Dia makan nasi',
      status: 'pending',
      translatorId: '01USER00000000000000000002',
      reviewedBy: null,
      reviewedAt: null,
      createdAt: new Date(),
      updatedAt: null,
    });
    translationRepo.findAccepted.mockResolvedValue(null);
    translationRepo.updateStatus.mockResolvedValue({
      id: '01TR0000000000000000000003',
      reff: 'lemma_example',
      reffId: '01EX0000000000000000000001',
      sourceBody: 'Ia makatn nasi',
      body: 'Dia makan nasi',
      status: 'accepted',
      translatorId: '01USER00000000000000000002',
      reviewedBy: '01VER0000000000000000000001',
      reviewedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    words.findExampleById.mockResolvedValue({
      id: '01EX0000000000000000000001',
      sourceSentence: 'Ia makatn nasi',
      status: 'published',
    });
    words.findLanguageIdByCode.mockResolvedValue('01LANGID');
    words.applyExampleTargetSentence.mockResolvedValue({
      id: '01EX0000000000000000000001',
      targetSentence: 'Dia makan nasi',
    });

    await new ResolveTranslationUseCase(
      translationRepo as never,
      audit as never,
      words as never,
    ).execute({
      id: '01TR0000000000000000000003',
      action: 'approve',
      reviewerId: '01VER0000000000000000000001',
    });

    expect(words.applyExampleTargetSentence).toHaveBeenCalledWith(
      '01EX0000000000000000000001',
      { targetSentence: 'Dia makan nasi', targetLanguageId: '01LANGID' },
      '01VER0000000000000000000001',
    );
  });
});

describe('AutoPromoteLemmaExampleTranslationUseCase', () => {
  it('upsert accepted bila published + target_sentence', async () => {
    const { AutoPromoteLemmaExampleTranslationUseCase } = await import(
      '../../application/use-cases/auto-promote-lemma-example-translation.use-case'
    );
    const translationRepo = { upsertAccepted: vi.fn() };
    await new AutoPromoteLemmaExampleTranslationUseCase(
      translationRepo as never,
    ).execute({
      example: {
        id: '01EX',
        sourceSentence: 'A',
        targetSentence: 'B',
        status: 'published',
      },
      actorId: '01ACTOR',
    });
    expect(translationRepo.upsertAccepted).toHaveBeenCalledWith(
      expect.objectContaining({
        reff: 'lemma_example',
        reffId: '01EX',
        sourceBody: 'A',
        body: 'B',
      }),
    );
  });

  it('no-op tanpa target_sentence', async () => {
    const { AutoPromoteLemmaExampleTranslationUseCase } = await import(
      '../../application/use-cases/auto-promote-lemma-example-translation.use-case'
    );
    const translationRepo = { upsertAccepted: vi.fn() };
    await new AutoPromoteLemmaExampleTranslationUseCase(
      translationRepo as never,
    ).execute({
      example: {
        id: '01EX',
        sourceSentence: 'A',
        targetSentence: null,
        status: 'published',
      },
      actorId: '01ACTOR',
    });
    expect(translationRepo.upsertAccepted).not.toHaveBeenCalled();
  });
});
