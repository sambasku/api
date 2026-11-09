import { describe, expect, it, vi } from 'vitest';
import { ForbiddenError, NotFoundError } from '@/shared/errors/app-error';
import { AttachJinyeAudioUseCase } from '../../application/use-cases/attach-jinye-audio.use-case';
import type { Jinye } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

vi.mock('@/modules/word/application/utils/assert-can-contribute', () => ({
  assertCanContribute: vi.fn(async () => undefined),
}));

vi.mock('@/modules/word/application/utils/validate-audio-file', () => ({
  validateAudioFile: vi.fn(({ bytes }: { bytes: Uint8Array }) => ({
    bytes,
    mimeType: 'audio/wav',
    size: bytes.length,
    filename: 'recording.wav',
  })),
  clampDurationMs: vi.fn((v: unknown) => (typeof v === 'number' ? v : 1200)),
}));

const ACTOR = '01ACTORJINYE00000000000000';
const OTHER = '01OTHERJINYE00000000000000';

function makeJinye(overrides: Partial<Jinye> = {}): Jinye {
  return {
    id: '01JINYE0000000000000000001',
    userId: ACTOR,
    username: 'aji',
    displayName: 'Aji',
    avatarUrl: null,
    userRole: 'contributor',
    body: '',
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

describe('AttachJinyeAudioUseCase', () => {
  it('menolak jika bukan pemilik', async () => {
    const repo: JinyeRepository = {
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
    const uc = new AttachJinyeAudioUseCase(
      repo,
      {
        providerName: 'github',
        upload: vi.fn(),
        delete: vi.fn(),
      } as never,
      { record: vi.fn() } as never,
    );
    await expect(
      uc.execute({
        jinyeId: '01JINYE0000000000000000001',
        userId: OTHER,
        bytes: new Uint8Array([1, 2, 3]),
        mimeType: 'audio/wav',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('404 jika jinye hilang', async () => {
    const repo: JinyeRepository = {
      create: vi.fn(),
      findById: vi.fn(async () => null),
      list: vi.fn(),
      findLatestCreatedAtByUser: vi.fn(),
      findLatestQuotaConsumingCreatedAtByUser: vi.fn(),
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
    const uc = new AttachJinyeAudioUseCase(
      repo,
      {
        providerName: 'github',
        upload: vi.fn(),
        delete: vi.fn(),
      } as never,
      { record: vi.fn() } as never,
    );
    await expect(
      uc.execute({
        jinyeId: '01JINYE0000000000000000001',
        userId: ACTOR,
        bytes: new Uint8Array([1, 2, 3]),
        mimeType: 'audio/wav',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('upload + setAudio untuk owner', async () => {
    const base = makeJinye();
    const withAudio = makeJinye({
      audio: {
        url: 'https://cdn.example/a.wav',
        mimeType: 'audio/wav',
        fileSize: 3,
        durationMs: 1200,
        provider: 'github',
        providerFileId: 'assets/audio/jinye/x/y.wav',
        sha: 'abc',
      },
    });
    const repo = {
      create: vi.fn(),
      findById: vi.fn(async () => base),
      list: vi.fn(),
      findLatestCreatedAtByUser: vi.fn(),
      findLatestQuotaConsumingCreatedAtByUser: vi.fn(),
      updateBody: vi.fn(),
      listRevisions: vi.fn(),
      markLemmaLinksStale: vi.fn(),
      findPlainRepostByUser: vi.fn(),
      adjustRepostCount: vi.fn(),
      markDeletedByAuthor: vi.fn(),
      setAudio: vi.fn(async () => withAudio),
    } as unknown as JinyeRepository;
    const upload = vi.fn(async () => ({
      url: 'https://cdn.example/a.wav',
      size: 3,
      path: 'assets/audio/jinye/x/y.wav',
      sha: 'abc',
    }));
    const uc = new AttachJinyeAudioUseCase(
      repo,
      { providerName: 'github', upload, delete: vi.fn() } as never,
      { record: vi.fn(async () => undefined) } as never,
    );
    const out = await uc.execute({
      jinyeId: base.id,
      userId: ACTOR,
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: 'audio/wav',
      durationMs: 1200,
    });
    expect(out.audio?.url).toBe('https://cdn.example/a.wav');
    expect(upload).toHaveBeenCalled();
    expect(repo.setAudio).toHaveBeenCalled();
  });
});
