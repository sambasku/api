import { BadRequestError, UnauthorizedError } from '@/shared/errors/app-error';
import type { User } from '@/modules/auth/domain/entities/user.entity';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';
import type { UserConsentRepository } from '@/modules/legal/domain/repositories/user-consent.repository';
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
  /** True bila user belum menyetujui terms/privacy versi aktif. */
  requiresConsent: boolean;
}

function toMyProfile(user: User, requiresConsent: boolean): MyProfileResult {
  return {
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    regionId: user.regionId,
    villageId: user.villageId,
    avatarUrl: user.avatarUrl,
    hasReadContributionGuide: user.readContributionGuideAt !== null,
    requiresConsent,
  };
}

export class GetMyProfileUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly settingsRepo?: AppSettingsRepository,
    private readonly consentRepo?: UserConsentRepository,
  ) {}

  async execute(userId: string): Promise<MyProfileResult> {
    const user = await this.userRepo.findById(userId);
    if (!user || user.deletedAt || !user.isActive) {
      throw new UnauthorizedError('UNAUTHORIZED', 'Sesi tidak valid');
    }
    const requiresConsent = await this.computeRequiresConsent(userId);
    return toMyProfile(user, requiresConsent);
  }

  /**
   * True bila versi consent terakhir user != versi aktif (atau belum ada
   * consent sama sekali). Legal belum dikonfigurasi = false (tidak bisa
   * minta persetujuan tanpa dokumen).
   */
  private async computeRequiresConsent(userId: string): Promise<boolean> {
    if (!this.settingsRepo || !this.consentRepo) return false;
    const active = await this.settingsRepo.getLegalActiveVersions();
    if (!active) return false;
    // 1 query untuk kedua tipe (bukan 2 subrequest terpisah).
    const latest = await this.consentRepo.findLatestByUserAll(userId);
    return (
      latest.terms?.documentVersion !== active.termsVersion ||
      latest.privacy?.documentVersion !== active.privacyVersion
    );
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

    return toMyProfile(updated, false);
  }
}

