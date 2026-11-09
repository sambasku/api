import { describe, expect, it, vi } from 'vitest';
import { RateLimitedError, ValidationError } from '@/shared/errors/app-error';
import { CreateJinyeUseCase } from '../../application/use-cases/create-jinye.use-case';
import type { Jinye } from '../../domain/entities/jinye.entity';
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

function makeJinye(overrides: Partial<Jinye> = {}): Jinye {
  return {
    id: '01JINYE0000000000000000001',
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
    isEdited: false,
    ...overrides,
  };
}

describe('CreateJinyeUseCase', () => {
  it('menolak body kosong tanpa media', async () => {
    const repo: JinyeRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      list: vi.fn(),
      findLatestCreatedAtByUser: vi.fn(async () => null),
      findLatestQuotaConsumingCreatedAtByUser: vi.fn(async () => null),
      updateBody: vi.fn(),
      listRevisions: vi.fn(),
      markLemmaLinksStale: vi.fn(),
      findPlainRepostByUser: vi.fn(),
      adjustRepostCount: vi.fn(),
      markDeletedByAuthor: vi.fn(),
      setAudio: vi.fn(),
      createComment: vi.fn(),
      findCommentById: vi.fn(),
      listCommentsByJinyeId: vi.fn(),
      markCommentDeletedByAuthor: vi.fn(),
      incrementPublishedCommentCount: vi.fn(),
    setStatus: vi.fn(),
    getPinnedJinyeId: vi.fn(),
    setPinnedJinyeId: vi.fn(),
    clearPinnedIf: vi.fn(),
    createLemmaLink: vi.fn(),
    findLemmaLinkById: vi.fn(),
    listLemmaLinksByJinyeId: vi.fn(),
    listActiveLemmaLinksForTarget: vi.fn(),
    updateLemmaLink: vi.fn(),
    deleteLemmaLink: vi.fn(),
    createTranslation: vi.fn(),
    findTranslationById: vi.fn(),
    listTranslationsByJinyeId: vi.fn(),
    findPendingTranslationByTranslator: vi.fn(),
    findAcceptedTranslation: vi.fn(),
    updateTranslation: vi.fn(),
    rejectPendingTranslations: vi.fn(),
    };
    const uc = new CreateJinyeUseCase(
      repo,
      { record: vi.fn() } as never,
      { listAllActiveWords: vi.fn(async () => []) },
    );
    await expect(uc.execute({ userId: ACTOR, body: '  ' })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('menolak create kedua dalam 24 jam', async () => {
    const repo: JinyeRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      list: vi.fn(),
      findLatestCreatedAtByUser: vi.fn(async () => new Date()),
      findLatestQuotaConsumingCreatedAtByUser: vi.fn(async () => new Date()),
      updateBody: vi.fn(),
      listRevisions: vi.fn(),
      markLemmaLinksStale: vi.fn(),
      findPlainRepostByUser: vi.fn(),
      adjustRepostCount: vi.fn(),
      markDeletedByAuthor: vi.fn(),
      setAudio: vi.fn(),
      createComment: vi.fn(),
      findCommentById: vi.fn(),
      listCommentsByJinyeId: vi.fn(),
      markCommentDeletedByAuthor: vi.fn(),
      incrementPublishedCommentCount: vi.fn(),
    setStatus: vi.fn(),
    getPinnedJinyeId: vi.fn(),
    setPinnedJinyeId: vi.fn(),
    clearPinnedIf: vi.fn(),
    createLemmaLink: vi.fn(),
    findLemmaLinkById: vi.fn(),
    listLemmaLinksByJinyeId: vi.fn(),
    listActiveLemmaLinksForTarget: vi.fn(),
    updateLemmaLink: vi.fn(),
    deleteLemmaLink: vi.fn(),
    createTranslation: vi.fn(),
    findTranslationById: vi.fn(),
    listTranslationsByJinyeId: vi.fn(),
    findPendingTranslationByTranslator: vi.fn(),
    findAcceptedTranslation: vi.fn(),
    updateTranslation: vi.fn(),
    rejectPendingTranslations: vi.fn(),
    };
    const uc = new CreateJinyeUseCase(
      repo,
      { record: vi.fn() } as never,
      { listAllActiveWords: vi.fn(async () => []) },
    );
    await expect(
      uc.execute({ userId: ACTOR, body: 'Halo Sambas' }),
    ).rejects.toBeInstanceOf(RateLimitedError);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('mengizinkan voice-only via hasPendingAudio', async () => {
    const created = makeJinye({ body: '' });
    const repo: JinyeRepository = {
      create: vi.fn(async () => created),
      findById: vi.fn(),
      list: vi.fn(),
      findLatestCreatedAtByUser: vi.fn(async () => null),
      findLatestQuotaConsumingCreatedAtByUser: vi.fn(async () => null),
      updateBody: vi.fn(),
      listRevisions: vi.fn(),
      markLemmaLinksStale: vi.fn(),
      findPlainRepostByUser: vi.fn(),
      adjustRepostCount: vi.fn(),
      markDeletedByAuthor: vi.fn(),
      setAudio: vi.fn(),
      createComment: vi.fn(),
      findCommentById: vi.fn(),
      listCommentsByJinyeId: vi.fn(),
      markCommentDeletedByAuthor: vi.fn(),
      incrementPublishedCommentCount: vi.fn(),
    setStatus: vi.fn(),
    getPinnedJinyeId: vi.fn(),
    setPinnedJinyeId: vi.fn(),
    clearPinnedIf: vi.fn(),
    createLemmaLink: vi.fn(),
    findLemmaLinkById: vi.fn(),
    listLemmaLinksByJinyeId: vi.fn(),
    listActiveLemmaLinksForTarget: vi.fn(),
    updateLemmaLink: vi.fn(),
    deleteLemmaLink: vi.fn(),
    createTranslation: vi.fn(),
    findTranslationById: vi.fn(),
    listTranslationsByJinyeId: vi.fn(),
    findPendingTranslationByTranslator: vi.fn(),
    findAcceptedTranslation: vi.fn(),
    updateTranslation: vi.fn(),
    rejectPendingTranslations: vi.fn(),
    };
    const uc = new CreateJinyeUseCase(
      repo,
      { record: vi.fn(async () => undefined) } as never,
      { listAllActiveWords: vi.fn(async () => []) },
    );
    const out = await uc.execute({
      userId: ACTOR,
      body: '',
      hasPendingAudio: true,
    });
    expect(out.body).toBe('');
    expect(repo.create).toHaveBeenCalled();
  });

  it('menyimpan teks dan menulis activity', async () => {
    const created = makeJinye({ body: 'Halo Sambas' });
    const repo: JinyeRepository = {
      create: vi.fn(async () => created),
      findById: vi.fn(),
      list: vi.fn(),
      findLatestCreatedAtByUser: vi.fn(async () => null),
      findLatestQuotaConsumingCreatedAtByUser: vi.fn(async () => null),
      updateBody: vi.fn(),
      listRevisions: vi.fn(),
      markLemmaLinksStale: vi.fn(),
      findPlainRepostByUser: vi.fn(),
      adjustRepostCount: vi.fn(),
      markDeletedByAuthor: vi.fn(),
      setAudio: vi.fn(),
      createComment: vi.fn(),
      findCommentById: vi.fn(),
      listCommentsByJinyeId: vi.fn(),
      markCommentDeletedByAuthor: vi.fn(),
      incrementPublishedCommentCount: vi.fn(),
    setStatus: vi.fn(),
    getPinnedJinyeId: vi.fn(),
    setPinnedJinyeId: vi.fn(),
    clearPinnedIf: vi.fn(),
    createLemmaLink: vi.fn(),
    findLemmaLinkById: vi.fn(),
    listLemmaLinksByJinyeId: vi.fn(),
    listActiveLemmaLinksForTarget: vi.fn(),
    updateLemmaLink: vi.fn(),
    deleteLemmaLink: vi.fn(),
    createTranslation: vi.fn(),
    findTranslationById: vi.fn(),
    listTranslationsByJinyeId: vi.fn(),
    findPendingTranslationByTranslator: vi.fn(),
    findAcceptedTranslation: vi.fn(),
    updateTranslation: vi.fn(),
    rejectPendingTranslations: vi.fn(),
    };
    const activity = { safe: vi.fn(async () => undefined) };
    const audit = { record: vi.fn(async () => undefined) };
    const uc = new CreateJinyeUseCase(
      repo,
      audit as never,
      { listAllActiveWords: vi.fn(async () => []) },
      undefined,
      activity,
    );
    const out = await uc.execute({ userId: ACTOR, body: 'Halo Sambas' });
    expect(out.body).toBe('Halo Sambas');
    expect(activity.safe).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'jinye_created',
        actorId: ACTOR,
        targetId: created.id,
      }),
    );
  });
});
