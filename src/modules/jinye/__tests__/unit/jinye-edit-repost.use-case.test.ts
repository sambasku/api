import { describe, expect, it, vi } from 'vitest';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitedError,
  ValidationError,
} from '@/shared/errors/app-error';
import { UpdateJinyeUseCase } from '../../application/use-cases/update-jinye.use-case';
import { GetJinyeEditHistoryUseCase } from '../../application/use-cases/get-jinye-edit-history.use-case';
import { RepostJinyeUseCase } from '../../application/use-cases/repost-jinye.use-case';
import { UnrepostJinyeUseCase } from '../../application/use-cases/unrepost-jinye.use-case';
import { QuoteJinyeUseCase } from '../../application/use-cases/quote-jinye.use-case';
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

const OWNER = '01OWNERJINYE0000000000000';
const OTHER = '01OTHERJINYE0000000000000';
const JINYE_ID = '01JINYE0000000000000000001';
const ORIG_ID = '01JINYEORIG000000000000001';

function makeJinye(overrides: Partial<Jinye> = {}): Jinye {
  return {
    id: JINYE_ID,
    userId: OWNER,
    username: 'aji',
    displayName: 'Aji',
    avatarUrl: null,
    userRole: null,
    body: 'halo samabas',
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

function repo(overrides: Partial<JinyeRepository> = {}): JinyeRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(async () => makeJinye()),
    list: vi.fn(),
    findLatestQuotaConsumingCreatedAtByUser: vi.fn(async () => null),
    findLatestCreatedAtByUser: vi.fn(async () => null),
    markDeletedByAuthor: vi.fn(),
    takedown: vi.fn(),
    updateBody: vi.fn(async () =>
      makeJinye({ body: 'edited', isEdited: true, updatedAt: new Date() }),
    ),
    listRevisions: vi.fn(async () => []),
    markLemmaLinksStale: vi.fn(async () => 0),
    findPlainRepostByUser: vi.fn(async () => null),
    adjustRepostCount: vi.fn(async () => undefined),
    setAudio: vi.fn(),
    setStatus: vi.fn(),
    getPinnedJinyeId: vi.fn(),
    setPinnedJinyeId: vi.fn(),
    clearPinnedIf: vi.fn(),
    createComment: vi.fn(),
    findCommentById: vi.fn(),
    listCommentsByJinyeId: vi.fn(),
    markCommentDeletedByAuthor: vi.fn(),
    takedownComment: vi.fn(),
    incrementPublishedCommentCount: vi.fn(),
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
    ...overrides,
  };
}

const audit = { record: vi.fn(async () => undefined) } as never;
const blocklist = { listAllActiveWords: vi.fn(async () => []) };

describe('UpdateJinyeUseCase', () => {
  it('owner edit body + stale lemma links', async () => {
    const r = repo();
    const out = await new UpdateJinyeUseCase(r, audit, blocklist).execute({
      id: JINYE_ID,
      userId: OWNER,
      body: 'edited',
    });
    expect(out.body).toBe('edited');
    expect(r.updateBody).toHaveBeenCalled();
    expect(r.markLemmaLinksStale).toHaveBeenCalledWith(JINYE_ID);
  });

  it('bukan owner → Forbidden', async () => {
    const r = repo();
    await expect(
      new UpdateJinyeUseCase(r, audit, blocklist).execute({
        id: JINYE_ID,
        userId: OTHER,
        body: 'x',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('repost polos tidak bisa diedit', async () => {
    const r = repo({
      findById: vi.fn(async () =>
        makeJinye({ repostOfId: ORIG_ID, quoteBody: null, body: '' }),
      ),
    });
    await expect(
      new UpdateJinyeUseCase(r, audit, blocklist).execute({
        id: JINYE_ID,
        userId: OWNER,
        body: 'x',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('GetJinyeEditHistoryUseCase', () => {
  it('return current + revisions', async () => {
    const r = repo({
      listRevisions: vi.fn(async () => [
        {
          id: '01REV000000000000000000001',
          jinyeId: JINYE_ID,
          body: 'lama',
          editorId: OWNER,
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
      ]),
    });
    const out = await new GetJinyeEditHistoryUseCase(r).execute(JINYE_ID);
    expect(out.current.body).toBe('halo samabas');
    expect(out.revisions).toHaveLength(1);
    expect(out.current.is_edited).toBe(true);
  });

  it('bukan published → NotFound', async () => {
    const r = repo({
      findById: vi.fn(async () => makeJinye({ status: 'archived' })),
    });
    await expect(
      new GetJinyeEditHistoryUseCase(r).execute(JINYE_ID),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('RepostJinyeUseCase', () => {
  it('buat repost polos tanpa kuota + activity', async () => {
    const created = makeJinye({
      id: '01REPOST0000000000000000001',
      userId: OTHER,
      body: '',
      repostOfId: ORIG_ID,
    });
    const r = repo({
      findById: vi.fn(async () => makeJinye({ id: ORIG_ID })),
      create: vi.fn(async () => created),
    });
    const activity = { safe: vi.fn(async () => undefined) };
    const out = await new RepostJinyeUseCase(r, audit, activity).execute({
      jinyeId: ORIG_ID,
      userId: OTHER,
    });
    expect(out.repostOfId).toBe(ORIG_ID);
    expect(r.adjustRepostCount).toHaveBeenCalledWith(ORIG_ID, 1);
    expect(activity.safe).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'jinye_reposted' }),
    );
  });

  it('sudah merepost → Conflict', async () => {
    const r = repo({
      findById: vi.fn(async () => makeJinye({ id: ORIG_ID })),
      findPlainRepostByUser: vi.fn(async () =>
        makeJinye({ repostOfId: ORIG_ID, userId: OTHER }),
      ),
    });
    await expect(
      new RepostJinyeUseCase(r, audit).execute({
        jinyeId: ORIG_ID,
        userId: OTHER,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('tidak bisa merepost milik sendiri', async () => {
    const r = repo({
      findById: vi.fn(async () => makeJinye({ id: ORIG_ID, userId: OWNER })),
    });
    await expect(
      new RepostJinyeUseCase(r, audit).execute({
        jinyeId: ORIG_ID,
        userId: OWNER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('depth > 1 ditolak', async () => {
    const r = repo({
      findById: vi.fn(async () =>
        makeJinye({ id: ORIG_ID, repostOfId: '01NESTED000000000000000001' }),
      ),
    });
    await expect(
      new RepostJinyeUseCase(r, audit).execute({
        jinyeId: ORIG_ID,
        userId: OTHER,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('UnrepostJinyeUseCase', () => {
  it('hapus repost + hide activity', async () => {
    const r = repo({
      findPlainRepostByUser: vi.fn(async () =>
        makeJinye({
          id: '01REPOST0000000000000000001',
          userId: OTHER,
          repostOfId: ORIG_ID,
        }),
      ),
      markDeletedByAuthor: vi.fn(async () => true),
      takedown: vi.fn(),
    });
    const activity = { safe: vi.fn(async () => undefined) };
    await new UnrepostJinyeUseCase(r, audit, activity).execute({
      jinyeId: ORIG_ID,
      userId: OTHER,
    });
    expect(r.adjustRepostCount).toHaveBeenCalledWith(ORIG_ID, -1);
    expect(activity.safe).toHaveBeenCalledWith(
      expect.objectContaining({ hidden: true, kind: 'jinye_reposted' }),
    );
  });
});

describe('QuoteJinyeUseCase', () => {
  it('buat quote + makan kuota + activity', async () => {
    const created = makeJinye({
      id: '01QUOTE00000000000000000001',
      userId: OTHER,
      body: '',
      repostOfId: ORIG_ID,
      quoteBody: 'kutipan bagus',
    });
    const r = repo({
      findById: vi.fn(async () => makeJinye({ id: ORIG_ID })),
      create: vi.fn(async () => created),
    });
    const activity = { safe: vi.fn(async () => undefined) };
    const out = await new QuoteJinyeUseCase(
      r,
      audit,
      blocklist,
      undefined,
      activity,
    ).execute({
      jinyeId: ORIG_ID,
      userId: OTHER,
      quoteBody: 'kutipan bagus',
    });
    expect(out.quoteBody).toBe('kutipan bagus');
    expect(activity.safe).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'jinye_quote_created' }),
    );
  });

  it('kuota 24 jam → RateLimited', async () => {
    const r = repo({
      findLatestQuotaConsumingCreatedAtByUser: vi.fn(
        async () => new Date(),
      ),
    });
    await expect(
      new QuoteJinyeUseCase(r, audit, blocklist).execute({
        jinyeId: ORIG_ID,
        userId: OTHER,
        quoteBody: 'x',
      }),
    ).rejects.toBeInstanceOf(RateLimitedError);
  });
});
