import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PromoteJinyeExampleUseCase } from '../../application/use-cases/promote-jinye-example.use-case';
import { CreateJinyeTranslationUseCase } from '../../application/use-cases/create-jinye-translation.use-case';
import { ResolveJinyeTranslationUseCase } from '../../application/use-cases/resolve-jinye-translation.use-case';

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
  audio: {
    url: 'https://cdn.example/a.m4a',
    mimeType: 'audio/mp4',
    fileSize: 1200,
    durationMs: 3000,
    provider: 'github',
    providerFileId: 'jinye/a.m4a',
    sha: null,
  },
  repostOfId: null,
  quoteBody: null,
  status: 'published' as const,
  publishedCommentCount: 0,
  repostCount: 0,
  createdAt: new Date(),
  updatedAt: null,
};

describe('PromoteJinyeExampleUseCase', () => {
  const repo = {
    findById: vi.fn(),
  };
  const words = {
    findById: vi.fn(),
    findMeaningById: vi.fn(),
    findFirstMeaningId: vi.fn(),
    findLanguageIdByCode: vi.fn(),
    addExample: vi.fn(),
    addWordAudio: vi.fn(),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    vi.clearAllMocks();
    repo.findById.mockResolvedValue(jinyeBase);
    words.findById.mockResolvedValue({
      id: '01WORD00000000000000000001',
      languageId: '01LANGSBS0000000000000001',
      status: 'published',
      isVerified: true,
      deletedAt: null,
    });
    words.findFirstMeaningId.mockResolvedValue('01MEANING00000000000000001');
    words.findLanguageIdByCode.mockResolvedValue('01LANGID000000000000000001');
    words.addExample.mockResolvedValue({
      id: '01EXAMPLE00000000000000001',
      status: 'pending_review',
      isVerified: false,
    });
    words.addWordAudio.mockResolvedValue({ id: '01AUDIO0000000000000000001' });
  });

  it('promotes body + audio for owner', async () => {
    const out = await new PromoteJinyeExampleUseCase(
      repo as never,
      words as never,
      audit as never,
    ).execute({
      jinyeId: jinyeBase.id,
      userId: jinyeBase.userId,
      role: 'contributor',
      wordId: '01WORD00000000000000000001',
      includeAudio: true,
      targetSentence: 'Saya makan nasi',
    });

    expect(out.exampleId).toBe('01EXAMPLE00000000000000001');
    expect(out.wordAudioId).toBe('01AUDIO0000000000000000001');
    expect(words.addExample).toHaveBeenCalledWith(
      '01MEANING00000000000000001',
      expect.objectContaining({
        sourceType: 'jinye',
        sourceReference: jinyeBase.id,
        sourceSentence: 'Aku makatn nasi',
        targetSentence: 'Saya makan nasi',
      }),
      jinyeBase.userId,
    );
  });

  it('rejects non-owner', async () => {
    await expect(
      new PromoteJinyeExampleUseCase(
        repo as never,
        words as never,
        audit as never,
      ).execute({
        jinyeId: jinyeBase.id,
        userId: '01OTHER0000000000000000001',
        role: 'contributor',
        wordId: '01WORD00000000000000000001',
      }),
    ).rejects.toMatchObject({ errorCode: 'NOT_OWNER' });
  });
});

describe('Jinye translation use cases', () => {
  const repo = {
    findById: vi.fn(),
    findPendingTranslationByTranslator: vi.fn(),
    createTranslation: vi.fn(),
    findTranslationById: vi.fn(),
    findAcceptedTranslation: vi.fn(),
    updateTranslation: vi.fn(),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    vi.clearAllMocks();
    repo.findById.mockResolvedValue(jinyeBase);
    repo.findPendingTranslationByTranslator.mockResolvedValue(null);
    repo.createTranslation.mockResolvedValue({
      id: '01TR0000000000000000000001',
      jinyeId: jinyeBase.id,
      bodyId: 'Saya makan nasi',
      status: 'pending',
      translatorId: '01USER00000000000000000002',
      reviewedBy: null,
      reviewedAt: null,
      createdAt: new Date(),
      updatedAt: null,
    });
  });

  it('creates pending translation', async () => {
    const row = await new CreateJinyeTranslationUseCase(
      repo as never,
      audit as never,
    ).execute({
      jinyeId: jinyeBase.id,
      userId: '01USER00000000000000000002',
      bodyId: 'Saya makan nasi',
    });
    expect(row.status).toBe('pending');
    expect(repo.createTranslation).toHaveBeenCalled();
  });

  it('approves translation and supersedes previous accepted', async () => {
    repo.findTranslationById.mockResolvedValue({
      id: '01TR0000000000000000000001',
      jinyeId: jinyeBase.id,
      bodyId: 'Saya makan nasi',
      status: 'pending',
      translatorId: '01USER00000000000000000002',
      reviewedBy: null,
      reviewedAt: null,
      createdAt: new Date(),
      updatedAt: null,
    });
    repo.findAcceptedTranslation.mockResolvedValue({
      id: '01TROLD0000000000000000001',
      jinyeId: jinyeBase.id,
      bodyId: 'lama',
      status: 'accepted',
      translatorId: '01USER00000000000000000003',
      reviewedBy: null,
      reviewedAt: null,
      createdAt: new Date(),
      updatedAt: null,
    });
    repo.updateTranslation.mockImplementation(async (id, patch) => ({
      id,
      jinyeId: jinyeBase.id,
      bodyId: 'Saya makan nasi',
      status: patch.status ?? 'pending',
      translatorId: '01USER00000000000000000002',
      reviewedBy: patch.reviewedBy ?? null,
      reviewedAt: patch.reviewedAt ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const out = await new ResolveJinyeTranslationUseCase(
      repo as never,
      audit as never,
    ).execute({
      jinyeId: jinyeBase.id,
      translationId: '01TR0000000000000000000001',
      reviewerId: '01VER0000000000000000000001',
      action: 'approve',
    });

    expect(repo.updateTranslation).toHaveBeenCalledWith(
      '01TROLD0000000000000000001',
      expect.objectContaining({ status: 'rejected' }),
    );
    expect(out.status).toBe('accepted');
  });
});
