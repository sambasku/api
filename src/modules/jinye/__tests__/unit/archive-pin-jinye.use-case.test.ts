import { describe, expect, it, vi } from 'vitest';
import { BadRequestError, NotFoundError } from '@/shared/errors/app-error';
import { ArchiveJinyeUseCase } from '../../application/use-cases/archive-jinye.use-case';
import { PinJinyeUseCase } from '../../application/use-cases/pin-jinye.use-case';
import { UnpinJinyeUseCase } from '../../application/use-cases/unpin-jinye.use-case';
import { UnarchiveJinyeUseCase } from '../../application/use-cases/unarchive-jinye.use-case';
import type { Jinye } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

const OWNER = '01OWNERJINYE0000000000000';
const JINYE_ID = '01JINYE0000000000000000001';

function makeJinye(overrides: Partial<Jinye> = {}): Jinye {
  return {
    id: JINYE_ID,
    userId: OWNER,
    username: 'aji',
    displayName: 'Aji',
    avatarUrl: null,
    userRole: null,
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
    findPlainRepostByUser: vi.fn(),
    adjustRepostCount: vi.fn(),
    markDeletedByAuthor: vi.fn(),
    takedown: vi.fn(),
    setAudio: vi.fn(),
    setStatus: vi.fn(async () => makeJinye({ status: 'archived' })),
    getPinnedJinyeId: vi.fn(async () => null),
    setPinnedJinyeId: vi.fn(async () => undefined),
    clearPinnedIf: vi.fn(async () => undefined),
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
    rejectPendingTranslations: vi.fn(async () => 0),
    ...overrides,
  };
}

const audit = { record: vi.fn(async () => undefined) } as never;

describe('Archive / pin Jinye', () => {
  it('archive published → archived + clear pin', async () => {
    const r = repo();
    const out = await new ArchiveJinyeUseCase(r, audit).execute({
      id: JINYE_ID,
      userId: OWNER,
    });
    expect(out.status).toBe('archived');
    expect(r.clearPinnedIf).toHaveBeenCalledWith(JINYE_ID);
    expect(r.rejectPendingTranslations).toHaveBeenCalledWith(JINYE_ID);
  });

  it('unarchive archived → published', async () => {
    const r = repo({
      findById: vi.fn(async () => makeJinye({ status: 'archived' })),
      setStatus: vi.fn(async () => makeJinye({ status: 'published' })),
    });
    const out = await new UnarchiveJinyeUseCase(r, audit).execute({
      id: JINYE_ID,
      userId: OWNER,
    });
    expect(out.status).toBe('published');
  });

  it('pin non-published → BadRequest', async () => {
    const r = repo({
      findById: vi.fn(async () => makeJinye({ status: 'archived' })),
    });
    await expect(
      new PinJinyeUseCase(r, audit).execute({ id: JINYE_ID, userId: OWNER }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('pin published → setPinnedJinyeId', async () => {
    const r = repo();
    await new PinJinyeUseCase(r, audit).execute({
      id: JINYE_ID,
      userId: OWNER,
    });
    expect(r.setPinnedJinyeId).toHaveBeenCalledWith(OWNER, JINYE_ID);
  });

  it('unpin hanya jika sedang dipin', async () => {
    const r = repo({
      getPinnedJinyeId: vi.fn(async () => JINYE_ID),
    });
    await new UnpinJinyeUseCase(r, audit).execute({
      id: JINYE_ID,
      userId: OWNER,
    });
    expect(r.setPinnedJinyeId).toHaveBeenCalledWith(OWNER, null);
  });

  it('archive milik orang lain → NotFound', async () => {
    await expect(
      new ArchiveJinyeUseCase(repo(), audit).execute({
        id: JINYE_ID,
        userId: '01OTHER0000000000000000001',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
