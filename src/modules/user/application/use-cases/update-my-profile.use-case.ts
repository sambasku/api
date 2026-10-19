import { BadRequestError, UnauthorizedError } from '@/shared/errors/app-error';
import type { User } from '@/modules/auth/domain/entities/user.entity';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { RegionRepository } from '@/modules/region/domain/repositories/region.repository';
import type { UpdateMyProfileDto } from '../dto/update-my-profile.dto';

export interface MyProfileResult {
  username: string;
  displayName: string;
  bio: string | null;
  regionId: string | null;
  villageId: string | null;
  avatarUrl: string | null;
  hasReadContributionGuide: boolean;
}

function toMyProfile(user: User): MyProfileResult {
  return {
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    regionId: user.regionId,
    villageId: user.villageId,
    avatarUrl: user.avatarUrl,
    hasReadContributionGuide: user.readContributionGuideAt !== null,
  };
}

export class GetMyProfileUseCase {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(userId: string): Promise<MyProfileResult> {
    const user = await this.userRepo.findById(userId);
    if (!user || user.deletedAt || !user.isActive) {
      throw new UnauthorizedError('UNAUTHORIZED', 'Sesi tidak valid');
    }
    return toMyProfile(user);
  }
}

async function assertLocation(
  regionRepo: RegionRepository,
  regionId: string | null,
  villageId: string | null,
): Promise<void> {
  if (villageId && !regionId) {
    throw new BadRequestError('VALIDATION_ERROR', 'Desa butuh kecamatan', [
      { field: 'village_id', message: 'Pilih kecamatan dulu' },
    ]);
  }

  const [region, village] = await Promise.all([
    regionId ? regionRepo.findById(regionId) : Promise.resolve(null),
    villageId ? regionRepo.findById(villageId) : Promise.resolve(null),
  ]);

  if (regionId && (!region || region.type !== 'kecamatan' || region.status !== 'published')) {
    throw new BadRequestError('VALIDATION_ERROR', 'Kecamatan tidak valid', [
      { field: 'region_id', message: 'Pilih kecamatan yang masih ada' },
    ]);
  }

  if (
    villageId &&
    (!village || village.type !== 'desa' || village.status !== 'published' || village.parentId !== regionId)
  ) {
    throw new BadRequestError('VALIDATION_ERROR', 'Desa tidak valid', [
      { field: 'village_id', message: 'Pilih desa di kecamatan yang sama' },
    ]);
  }
}

export class UpdateMyProfileUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly regionRepo: RegionRepository,
  ) {}

  async execute(userId: string, dto: UpdateMyProfileDto): Promise<MyProfileResult> {
    const user = await this.userRepo.findById(userId);
    if (!user || user.deletedAt || !user.isActive) {
      throw new UnauthorizedError('UNAUTHORIZED', 'Sesi tidak valid');
    }

    const touchesLocation = dto.regionId !== undefined || dto.villageId !== undefined;
    if (touchesLocation) {
      const regionId = dto.regionId !== undefined ? dto.regionId : user.regionId;
      const villageId = dto.villageId !== undefined ? dto.villageId : user.villageId;
      await assertLocation(this.regionRepo, regionId, villageId);
    }

    const updated = await this.userRepo.updateProfile(userId, {
      ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {}),
      ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
      ...(dto.regionId !== undefined ? { regionId: dto.regionId } : {}),
      ...(dto.villageId !== undefined ? { villageId: dto.villageId } : {}),
      ...(dto.hasReadContributionGuide === true && user.readContributionGuideAt === null
        ? { readContributionGuideAt: new Date() }
        : {}),
    });

    return toMyProfile(updated);
  }
}
