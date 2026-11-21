import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '@/shared/errors/app-error';
import {
  CreateStickerUseCase,
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
  createdAt: new Date(),
  updatedAt: null,
  deletedAt: null,
};

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
      expect.objectContaining({ categorySlug: 'mood' }),
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
