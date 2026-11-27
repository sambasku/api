import { describe, expect, it, vi } from 'vitest';
import {
  NotFoundError,
  ValidationError,
} from '@/shared/errors/app-error';
import {
  AddFavoriteStickerUseCase,
  buildCustomStickerId,
  CreateMyStickerUseCase,
  CreateStickerUseCase,
  DeleteMyStickerUseCase,
  ListActiveStickersUseCase,
  UpdateStickerUseCase,
} from '../../application/use-cases/sticker.use-cases';
import type { Sticker } from '../../domain/entities/sticker.entity';

const base: Sticker = {
  id: 'cheer',
  imageUrl: 'https://cdn.example/cheer.png',
  playOnce: false,
  sortOrder: 10,
  isActive: true,
  categorySlug: 'reaksi',
  ownerUserId: null,
  displayName: null,
  visibility: 'public',
  providerFileId: null,
  createdAt: new Date(),
  updatedAt: null,
  deletedAt: null,
};

describe('buildCustomStickerId', () => {
  it('format <slug>-<ulid_lowercase> maksimal 64 karakter', () => {
    const ulid = '01JABCDEFGHJKMNPQRSTVWXYZ1';
    expect(buildCustomStickerId('Kopi Pagi!', ulid)).toBe(
      'kopi-pagi-01jabcdefghjkmnpqrstvwxyz1',
    );
    const longId = buildCustomStickerId(
      'nama stiker yang sangat panjang sekali melebihi batas maksimal',
      ulid,
    );
    expect(longId.length).toBeLessThanOrEqual(64);
    expect(longId.endsWith(`-${ulid.toLowerCase()}`)).toBe(true);
  });

  it('fallback ke stiker-<ulid> saat nama kosong atau simbol saja', () => {
    const ulid = '01JABCDEFGHJKMNPQRSTVWXYZ2';
    expect(buildCustomStickerId('   ', ulid)).toBe(
      'stiker-01jabcdefghjkmnpqrstvwxyz2',
    );
    expect(buildCustomStickerId('!!!', ulid)).toBe(
      'stiker-01jabcdefghjkmnpqrstvwxyz2',
    );
  });
});

describe('CreateStickerUseCase category_slug', () => {
  it('slug kategori invalid ditolak', async () => {
    const repo = { findById: vi.fn(), create: vi.fn() };
    const uc = new CreateStickerUseCase(repo as never);
    await expect(
      uc.execute({
        id: 'cheer',
        imageUrl: 'https://cdn.example/a.png',
        categorySlug: 'Bad Slug!',
        actorId: 'u1',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('kosong jadi null; valid tersimpan lower', async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ ...base, categorySlug: 'mood' }),
    };
    const uc = new CreateStickerUseCase(repo as never);
    await uc.execute({
      id: 'wave',
      imageUrl: 'https://cdn.example/w.gif',
      categorySlug: '  Mood ',
      actorId: 'u1',
    });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ categorySlug: 'mood', visibility: 'public' }),
    );

    repo.create.mockResolvedValue({ ...base, categorySlug: null });
    await uc.execute({
      id: 'ok',
      imageUrl: 'https://cdn.example/ok.png',
      categorySlug: '   ',
      actorId: 'u1',
    });
    expect(repo.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ categorySlug: null }),
    );
  });
});

describe('UpdateStickerUseCase category_slug', () => {
  it('boleh clear ke null', async () => {
    const repo = {
      update: vi.fn().mockResolvedValue({ ...base, categorySlug: null }),
    };
    const uc = new UpdateStickerUseCase(repo as never);
    await uc.execute({ id: 'cheer', categorySlug: null, actorId: 'u1' });
    expect(repo.update).toHaveBeenCalledWith(
      'cheer',
      expect.objectContaining({ categorySlug: null }),
    );
  });
});

describe('ListActiveStickersUseCase', () => {
  it('meneruskan q / category / cursor ke repo', async () => {
    const page = {
      items: [base],
      nextCursor: '10:cheer',
      categories: ['reaksi'],
    };
    const repo = { listActivePage: vi.fn().mockResolvedValue(page) };
    const uc = new ListActiveStickersUseCase(repo as never);
    const result = await uc.execute({
      q: 'che',
      categorySlug: 'reaksi',
      limit: 20,
      cursor: null,
    });
    expect(repo.listActivePage).toHaveBeenCalledWith({
      q: 'che',
      categorySlug: 'reaksi',
      limit: 20,
      cursor: null,
    });
    expect(result.categories).toEqual(['reaksi']);
  });
});

describe('AddFavoriteStickerUseCase', () => {
  it('menolak stiker tidak aktif / tidak ada dengan 404', async () => {
    const repo = { findActiveById: vi.fn().mockResolvedValue(null) };
    const uc = new AddFavoriteStickerUseCase(repo as never);
    await expect(
      uc.execute({ userId: 'u1', stickerId: 'missing' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('idempoten jika sudah favorit walau kuota penuh', async () => {
    const repo = {
      findActiveById: vi.fn().mockResolvedValue(base),
      isFavorite: vi.fn().mockResolvedValue(true),
      countFavorites: vi.fn(),
      addFavorite: vi.fn(),
    };
    const uc = new AddFavoriteStickerUseCase(repo as never, 1);
    const res = await uc.execute({ userId: 'u1', stickerId: 'cheer' });
    expect(res.id).toBe('cheer');
    expect(repo.addFavorite).not.toHaveBeenCalled();
  });

  it('menolak saat kuota favorit penuh dengan STICKER_FAVORITE_LIMIT_REACHED', async () => {
    const repo = {
      findActiveById: vi.fn().mockResolvedValue(base),
      isFavorite: vi.fn().mockResolvedValue(false),
      countFavorites: vi.fn().mockResolvedValue(50),
      addFavorite: vi.fn(),
    };
    const uc = new AddFavoriteStickerUseCase(repo as never, 50);
    await expect(
      uc.execute({ userId: 'u1', stickerId: 'cheer' }),
    ).rejects.toMatchObject({
      errorCode: 'STICKER_FAVORITE_LIMIT_REACHED',
    });
    expect(repo.addFavorite).not.toHaveBeenCalled();
  });
});

describe('CreateMyStickerUseCase & DeleteMyStickerUseCase', () => {
  it('menolak URL di luar endpoint ImageKit resmi', async () => {
    const repo = { countActiveByOwner: vi.fn().mockResolvedValue(0), create: vi.fn() };
    const uc = new CreateMyStickerUseCase(repo as never, {
      allowedUrlPrefix: 'https://ik.imagekit.io/sambasku',
    });
    await expect(
      uc.execute({
        userId: 'u1',
        name: 'Kopi',
        imageUrl: 'https://evil.example/a.png',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('menolak saat kuota custom stiker penuh', async () => {
    const repo = { countActiveByOwner: vi.fn().mockResolvedValue(20), create: vi.fn() };
    const uc = new CreateMyStickerUseCase(repo as never, {
      maxCustom: 20,
      allowedUrlPrefix: 'https://ik.imagekit.io/sambasku',
    });
    await expect(
      uc.execute({
        userId: 'u1',
        name: 'Kopi',
        imageUrl: 'https://ik.imagekit.io/sambasku/stickers/custom/a.webp',
      }),
    ).rejects.toMatchObject({
      errorCode: 'CUSTOM_STICKER_LIMIT_REACHED',
    });
  });

  it('membuat custom stiker visibility=private dengan id <slug>-<ulid>', async () => {
    const repo = {
      countActiveByOwner: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockImplementation(async (input) => ({
        ...base,
        ...input,
      })),
    };
    const uc = new CreateMyStickerUseCase(repo as never, {
      allowedUrlPrefix: 'https://ik.imagekit.io/sambasku',
    });
    const created = await uc.execute({
      userId: 'u1',
      name: 'Kopi Pagi',
      imageUrl: 'https://ik.imagekit.io/sambasku/stickers/custom/a.webp',
      providerFileId: 'ik_123',
    });
    expect(created.id).toMatch(/^kopi-pagi-[0-9a-z]{26}$/);
    expect(created.visibility).toBe('private');
    expect(created.ownerUserId).toBe('u1');
    expect(created.displayName).toBe('Kopi Pagi');
  });

  it('DeleteMyStickerUseCase hapus file di ImageKit saat providerFileId ada', async () => {
    const repo = {
      softDeleteByOwner: vi.fn().mockResolvedValue({
        ...base,
        id: 'kopi-01jabcdefghjkmnpqrstvwxyz1',
        ownerUserId: 'u1',
        visibility: 'private',
        providerFileId: 'ik_123',
      }),
    };
    const storage = { deleteFile: vi.fn().mockResolvedValue(undefined) };
    const uc = new DeleteMyStickerUseCase(repo as never, storage as never);
    await uc.execute({
      userId: 'u1',
      stickerId: 'kopi-01jabcdefghjkmnpqrstvwxyz1',
    });
    expect(storage.deleteFile).toHaveBeenCalledWith('ik_123');
  });

  it('DeleteMyStickerUseCase melempar 404 jika bukan milik user', async () => {
    const repo = { softDeleteByOwner: vi.fn().mockResolvedValue(null) };
    const uc = new DeleteMyStickerUseCase(repo as never);
    await expect(
      uc.execute({ userId: 'u2', stickerId: 'kopi-01jabcdefghjkmnpqrstvwxyz1' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
