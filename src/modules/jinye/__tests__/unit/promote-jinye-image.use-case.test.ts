import { describe, expect, it, vi } from 'vitest';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors/app-error';
import { PromoteJinyeImageUseCase } from '../../application/use-cases/promote-jinye-image.use-case';
import type { Jinye } from '../../domain/entities/jinye.entity';

vi.mock('@/modules/word/application/utils/assert-can-contribute', () => ({
  assertCanContribute: vi.fn(async () => undefined),
}));

const OWNER = '01OWNERJINYE0000000000000';
const OTHER = '01OTHERUSER0000000000000';
const JINYE_ID = '01JINYE0000000000000000001';
const WORD_ID = '01WORD00000000000000000001';
const IMG_A =
  'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/jinye/01AAA.jpg';
const IMG_B =
  'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/jinye/01BBB.jpg';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

function makeJinye(over: Partial<Jinye> = {}): Jinye {
  return {
    id: JINYE_ID,
    userId: OWNER,
    username: 'aji',
    displayName: 'Aji',
    avatarUrl: null,
    userRole: 'contributor',
    body: 'halo',
    bodyOriginal: null,
    images: [
      {
        url: IMG_A,
        providerFileId: 'assets/jinye/01AAA.jpg',
        publicUrl: IMG_A,
        contentWarnings: ['kekerasan', 'aneh'],
      },
      {
        url: IMG_B,
        providerFileId: 'assets/jinye/01BBB.jpg',
        publicUrl: IMG_B,
        contentWarnings: [],
      },
    ],
    audio: null,
    repostOfId: null,
    quoteBody: null,
    status: 'published',
    publishedCommentCount: 0,
    repostCount: 0,
    createdAt: new Date(),
    updatedAt: null,
    ...over,
  };
}

function setup(opts: { jinye?: Jinye | null; word?: unknown; failSecondInsert?: boolean } = {}) {
  let inserts = 0;
  const addWordImage = vi.fn(async (_wid: string, data: Record<string, unknown>) => {
    inserts += 1;
    if (opts.failSecondInsert && inserts === 2) throw new Error('db boom');
    return {
      id: `IMG${inserts}`,
      url: data.url as string,
      status: data.status as string,
      isVerified: data.isVerified as boolean,
    };
  });
  const words = {
    findById: vi.fn(async () =>
      opts.word === undefined
        ? { id: WORD_ID, status: 'published', isVerified: true, deletedAt: null }
        : opts.word,
    ),
    findWordImageBySource: vi.fn(async () => null),
    addWordImage,
    softDeleteWordImages: vi.fn(async () => undefined),
  };
  let uploads = 0;
  const storage = {
    providerName: 'github',
    upload: vi.fn(async (i: { path: string }) => {
      uploads += 1;
      return {
        path: i.path,
        url: `https://cdn.jsdelivr.net/gh/sambasku/images@main/${i.path}`,
        sha: `sha${uploads}`,
        size: 12,
      };
    }),
    delete: vi.fn(async () => undefined),
  };
  const audit = { record: vi.fn(async () => undefined) };
  const repo = {
    findById: vi.fn(async () => (opts.jinye === undefined ? makeJinye() : opts.jinye)),
  };
  const fetchBytes = vi.fn(async () => ({ bytes: PNG, mimeType: 'image/png' }));
  const uc = new PromoteJinyeImageUseCase(
    repo as never,
    words as never,
    storage as never,
    audit as never,
    undefined,
    fetchBytes,
  );
  return { uc, words, storage, audit, fetchBytes };
}

const base = {
  jinyeId: JINYE_ID,
  wordId: WORD_ID,
  imageUrls: [IMG_A],
};

describe('PromoteJinyeImageUseCase', () => {
  it('non-owner boleh; user biasa = pending (belum verified), salinan ke assets/words', async () => {
    const { uc, words, storage } = setup();
    const out = await uc.execute({ ...base, userId: OTHER, role: ['contributor'] });
    expect(out.images).toHaveLength(1);
    expect(out.images[0].isVerified).toBe(false);
    const path = storage.upload.mock.calls[0][0].path;
    expect(path).toMatch(/^assets\/words\/.+\.png$/);
    expect(words.addWordImage).toHaveBeenCalledWith(
      WORD_ID,
      expect.objectContaining({
        provider: 'github',
        isVerified: false,
        sourceType: 'jinye',
        sourceReference: `${JINYE_ID}:assets/jinye/01AAA.jpg`,
        contentWarnings: ['kekerasan'],
        isPrimary: false,
      }),
      OTHER,
    );
  });

  it('verifikator: langsung verified', async () => {
    const { uc } = setup();
    const out = await uc.execute({ ...base, userId: OTHER, role: ['editor'] });
    expect(out.images[0].isVerified).toBe(true);
  });

  it('Jinye tidak published / tidak ada: 404', async () => {
    await expect(
      setup({ jinye: makeJinye({ status: 'archived' }) }).uc.execute({
        ...base,
        userId: OTHER,
        role: ['contributor'],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      setup({ jinye: null }).uc.execute({ ...base, userId: OTHER, role: ['contributor'] }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('kata belum verified: 400', async () => {
    await expect(
      setup({
        word: { id: WORD_ID, status: 'published', isVerified: false, deletedAt: null },
      }).uc.execute({ ...base, userId: OTHER, role: ['contributor'] }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('foto yang bukan milik Jinye ini ditolak', async () => {
    await expect(
      setup().uc.execute({
        ...base,
        imageUrls: ['https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/jinye/ZZZ.jpg'],
        userId: OTHER,
        role: ['contributor'],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('foto yang sudah diajukan untuk kata ini: 409 tanpa unduh/unggah', async () => {
    const { uc, words, storage, fetchBytes } = setup();
    words.findWordImageBySource.mockResolvedValueOnce({ id: 'old' } as never);
    await expect(
      uc.execute({ ...base, userId: OTHER, role: ['contributor'] }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(fetchBytes).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('gagal di foto kedua: all-or-nothing, file dan baris dibatalkan', async () => {
    const { uc, words, storage } = setup({ failSecondInsert: true });
    await expect(
      uc.execute({
        ...base,
        imageUrls: [IMG_A, IMG_B],
        userId: OTHER,
        role: ['contributor'],
      }),
    ).rejects.toThrow('db boom');
    expect(words.softDeleteWordImages).toHaveBeenCalledWith(['IMG1']);
    expect(storage.delete).toHaveBeenCalledTimes(2);
  });

  it('tolak 0 atau lebih dari 4 foto', async () => {
    const { uc } = setup();
    await expect(
      uc.execute({ ...base, imageUrls: [], userId: OTHER, role: ['contributor'] }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
