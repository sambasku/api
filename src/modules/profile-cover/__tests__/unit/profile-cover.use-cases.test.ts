import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '@/shared/errors/app-error';
import { CreateProfileCoverUseCase } from '../../application/use-cases/profile-cover.use-cases';

describe('CreateProfileCoverUseCase', () => {
  it('tolak ukuran yang tidak sesuai varian tab', async () => {
    const repo = { create: vi.fn() };
    const uc = new CreateProfileCoverUseCase(repo as never);
    await expect(
      uc.execute({
        variant: 'tab',
        url: 'https://cdn.example/tab.webp',
        width: 800,
        height: 400,
        actorId: 'u1',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('menerima ukuran kanonik tab', async () => {
    const repo = {
      create: vi.fn().mockResolvedValue({
        id: 'x',
        variant: 'tab',
        url: 'https://cdn.example/tab.webp',
        fileId: null,
        width: 1032,
        height: 400,
        sizeBytes: 120_000,
        isActive: true,
        createdBy: 'u1',
        createdAt: new Date(),
        activatedAt: new Date(),
      }),
    };
    const uc = new CreateProfileCoverUseCase(repo as never);
    await uc.execute({
      variant: 'tab',
      url: 'https://cdn.example/tab.webp',
      width: 1032,
      height: 400,
      sizeBytes: 120_000,
      actorId: 'u1',
    });
    expect(repo.create).toHaveBeenCalled();
  });

  it('tolak ukuran yang tidak sesuai varian layanan', async () => {
    const repo = { create: vi.fn() };
    const uc = new CreateProfileCoverUseCase(repo as never);
    await expect(
      uc.execute({
        variant: 'layanan',
        url: 'https://cdn.example/layanan.webp',
        width: 1032,
        height: 400,
        actorId: 'u1',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('menerima ukuran kanonik layanan (1032x534)', async () => {
    const repo = {
      create: vi.fn().mockResolvedValue({
        id: 'y',
        variant: 'layanan',
        url: 'https://cdn.example/layanan.webp',
        fileId: null,
        width: 1032,
        height: 534,
        sizeBytes: 120_000,
        isActive: true,
        createdBy: 'u1',
        createdAt: new Date(),
        activatedAt: new Date(),
      }),
    };
    const uc = new CreateProfileCoverUseCase(repo as never);
    await uc.execute({
      variant: 'layanan',
      url: 'https://cdn.example/layanan.webp',
      width: 1032,
      height: 534,
      sizeBytes: 120_000,
      actorId: 'u1',
    });
    expect(repo.create).toHaveBeenCalled();
  });
});