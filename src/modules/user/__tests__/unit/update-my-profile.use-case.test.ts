import { describe, it, expect, vi } from 'vitest';
import { BadRequestError, UnauthorizedError } from '@/shared/errors/app-error';
import {
  GetMyProfileUseCase,
  UpdateMyProfileUseCase,
} from '../../application/use-cases/update-my-profile.use-case';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { User } from '@/modules/auth/domain/entities/user.entity';
import type { Region } from '@/modules/region/domain/entities/region.entity';
import type { RegionRepository } from '@/modules/region/domain/repositories/region.repository';

const USER_ID = '01TESTMEPROFILE0000000001';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: USER_ID,
    username: 'budi',
    displayName: 'budi',
    bio: null,
    regionId: null,
    villageId: null,
    email: 'budi@test.com',
    phone: null,
    passwordHash: 'hash',
    roles: ['contributor'],
    role: 'contributor',
    isActive: true,
    emailVerified: true,
    readContributionGuideAt: null,
    levelSeen: 1,
    notifyStreakReminder: true,
    notifyLevelUp: true,
    avatarUrl: null,
    avatarProvider: null,
    avatarProviderFileId: null,
    avatarSha: null,
    createdAt: new Date(),
    updatedAt: null,
    deletedAt: null,
    canContribute: true,
    contributeMutedUntil: null,
    ...overrides,
  };
}

describe('GetMyProfileUseCase', () => {
  it('mengembalikan field editor', async () => {
    const user = makeUser({ displayName: 'Budi Santoso', bio: 'Kontributor Sambas' });
    const userRepo = { findById: vi.fn().mockResolvedValue(user) } as unknown as UserRepository;
    const result = await new GetMyProfileUseCase(userRepo).execute(USER_ID);
    expect(result).toEqual({
      username: 'budi',
      displayName: 'Budi Santoso',
      bio: 'Kontributor Sambas',
      regionId: null,
      villageId: null,
      avatarUrl: null,
      hasReadContributionGuide: false,
      requiresConsent: false,
      notifyStreakReminder: true,
      notifyLevelUp: true,
      leveling: {
        points: 0,
        level: 1,
        nextLevelPoints: 20,
        titleCode: 'peninjau',
        exploration: 0,
        accuracy: 0,
        depth: 0,
        streakDays: 0,
      },
    });
  });

  it('sudah baca guide → has_read_contribution_guide true', async () => {
    const user = makeUser({ readContributionGuideAt: new Date() });
    const userRepo = { findById: vi.fn().mockResolvedValue(user) } as unknown as UserRepository;
    const result = await new GetMyProfileUseCase(userRepo).execute(USER_ID);
    expect(result.hasReadContributionGuide).toBe(true);
  });
});

function makeRegion(overrides: Partial<Region> & Pick<Region, 'id' | 'type'>): Region {
  return {
    slug: overrides.id,
    name: overrides.id,
    parentId: null,
    code: null,
    lat: null,
    lng: null,
    status: 'published',
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: null,
    ...overrides,
  };
}

function makeRegionRepo(items: Region[] = []): RegionRepository {
  return {
    findById: vi.fn(async (id: string) => items.find((item) => item.id === id) ?? null),
  } as unknown as RegionRepository;
}

describe('UpdateMyProfileUseCase', () => {
  const regionRepo = makeRegionRepo();

  it('memanggil updateProfile', async () => {
    const updated = makeUser({ displayName: 'Nama Baru', bio: 'Bio baru' });
    const userRepo = {
      findById: vi.fn().mockResolvedValue(makeUser()),
      updateProfile: vi.fn().mockResolvedValue(updated),
    } as unknown as UserRepository;

    const result = await new UpdateMyProfileUseCase(userRepo, regionRepo).execute(USER_ID, {
      displayName: 'Nama Baru',
      bio: 'Bio baru',
    });

    expect(userRepo.updateProfile).toHaveBeenCalledWith(USER_ID, {
      displayName: 'Nama Baru',
      bio: 'Bio baru',
    });
    expect(result.displayName).toBe('Nama Baru');
    expect(result.bio).toBe('Bio baru');
  });

  it('tap Mengerti → set read_contribution_guide_at', async () => {
    const updated = makeUser({ readContributionGuideAt: new Date() });
    const userRepo = {
      findById: vi.fn().mockResolvedValue(makeUser()),
      updateProfile: vi.fn().mockResolvedValue(updated),
    } as unknown as UserRepository;

    const result = await new UpdateMyProfileUseCase(userRepo, regionRepo).execute(USER_ID, {
      hasReadContributionGuide: true,
    });

    const arg = vi.mocked(userRepo.updateProfile).mock.calls[0][1];
    expect(arg.readContributionGuideAt).toBeInstanceOf(Date);
    expect(result.hasReadContributionGuide).toBe(true);
  });

  it('sudah baca → tidak set ulang timestamp', async () => {
    const readAt = new Date('2026-01-01T00:00:00Z');
    const userRepo = {
      findById: vi.fn().mockResolvedValue(makeUser({ readContributionGuideAt: readAt })),
      updateProfile: vi.fn().mockResolvedValue(makeUser({ readContributionGuideAt: readAt })),
    } as unknown as UserRepository;

    await new UpdateMyProfileUseCase(userRepo, regionRepo).execute(USER_ID, {
      hasReadContributionGuide: true,
    });

    const arg = vi.mocked(userRepo.updateProfile).mock.calls[0][1];
    expect(arg.readContributionGuideAt).toBeUndefined();
  });

  it('sesi invalid → UNAUTHORIZED', async () => {
    const userRepo = {
      findById: vi.fn().mockResolvedValue(null),
      updateProfile: vi.fn(),
    } as unknown as UserRepository;

    await expect(
      new UpdateMyProfileUseCase(userRepo, regionRepo).execute(USER_ID, { displayName: 'x' }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(userRepo.updateProfile).not.toHaveBeenCalled();
  });

  it('desa tanpa kecamatan ditolak', async () => {
    const userRepo = {
      findById: vi.fn().mockResolvedValue(makeUser()),
      updateProfile: vi.fn(),
    } as unknown as UserRepository;

    await expect(
      new UpdateMyProfileUseCase(userRepo, makeRegionRepo()).execute(USER_ID, {
        villageId: 'pemangkat/perapakan',
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(userRepo.updateProfile).not.toHaveBeenCalled();
  });

  it('desa yang induknya cocok disimpan', async () => {
    const updated = makeUser({ regionId: 'pemangkat', villageId: 'pemangkat/perapakan' });
    const userRepo = {
      findById: vi.fn().mockResolvedValue(makeUser()),
      updateProfile: vi.fn().mockResolvedValue(updated),
    } as unknown as UserRepository;
    const regions = makeRegionRepo([
      makeRegion({ id: 'pemangkat', type: 'kecamatan' }),
      makeRegion({ id: 'pemangkat/perapakan', type: 'desa', parentId: 'pemangkat' }),
    ]);

    const result = await new UpdateMyProfileUseCase(userRepo, regions).execute(USER_ID, {
      regionId: 'pemangkat',
      villageId: 'pemangkat/perapakan',
    });

    expect(userRepo.updateProfile).toHaveBeenCalledWith(USER_ID, {
      regionId: 'pemangkat',
      villageId: 'pemangkat/perapakan',
    });
    expect(result.regionId).toBe('pemangkat');
    expect(result.villageId).toBe('pemangkat/perapakan');
  });

  it('desa di kecamatan lain ditolak, termasuk saat region lama dipakai', async () => {
    const userRepo = {
      findById: vi.fn().mockResolvedValue(makeUser({ regionId: 'pemangkat' })),
      updateProfile: vi.fn(),
    } as unknown as UserRepository;
    const regions = makeRegionRepo([
      makeRegion({ id: 'pemangkat', type: 'kecamatan' }),
      makeRegion({ id: 'jawai/sarang-burung', type: 'desa', parentId: 'jawai' }),
    ]);

    await expect(
      new UpdateMyProfileUseCase(userRepo, regions).execute(USER_ID, {
        villageId: 'jawai/sarang-burung',
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(userRepo.updateProfile).not.toHaveBeenCalled();
  });
});
