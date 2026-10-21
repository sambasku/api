import { describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@/shared/errors/app-error';
import { UpdateVerifierApplicationScreenshotUseCase } from '../../application/use-cases/update-verifier-application-screenshot.use-case';
import type { VerifierApplication } from '../../domain/entities/verifier-application.entity';
import type { VerifierApplicationRepository } from '../../domain/repositories/verifier-application.repository';

const APP_ID = '01APP00000000000000000000';

function makeApp(): VerifierApplication {
  return {
    id: APP_ID,
    userId: '01USER0000000000000000000',
    username: 'budi',
    phone: '6281234567890',
    address: 'Jl. Sambas No. 1',
    socialLinks: [
      {
        platform: 'instagram',
        username: 'budi_sambas',
        screenshot: { url: 'https://ik.imagekit.io/old.png', provider_file_id: 'file_old' },
      },
    ],
    status: 'pending',
    adminComment: null,
    reviewedBy: null,
    reviewedByUsername: null,
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: null,
  };
}

function makeUseCase(app: VerifierApplication | null = makeApp()) {
  const appRepo = {
    updateSocialScreenshot: vi.fn().mockResolvedValue(app),
  } as unknown as VerifierApplicationRepository;
  return {
    appRepo,
    useCase: new UpdateVerifierApplicationScreenshotUseCase(appRepo),
  };
}

const screenshot = { url: 'https://ik.imagekit.io/new.png', provider_file_id: 'file_new' };

describe('UpdateVerifierApplicationScreenshotUseCase', () => {
  it('admin boleh mengganti screenshot pengajuan', async () => {
    const { useCase, appRepo } = makeUseCase();
    await useCase.execute({ applicationId: APP_ID, index: 0, actorRoles: ['admin'], screenshot });
    expect(appRepo.updateSocialScreenshot).toHaveBeenCalledWith(APP_ID, 0, screenshot);
  });

  it('root boleh mengganti screenshot pengajuan', async () => {
    const { useCase, appRepo } = makeUseCase();
    await useCase.execute({ applicationId: APP_ID, index: 0, actorRoles: ['root'], screenshot });
    expect(appRepo.updateSocialScreenshot).toHaveBeenCalled();
  });

  it('reviewer/editor/contributor ditolak (403)', async () => {
    const { useCase, appRepo } = makeUseCase();
    await expect(
      useCase.execute({
        applicationId: APP_ID,
        index: 0,
        actorRoles: ['reviewer', 'contributor'],
        screenshot,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(appRepo.updateSocialScreenshot).not.toHaveBeenCalled();
  });
});
