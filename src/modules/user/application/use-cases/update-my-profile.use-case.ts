import { BadRequestError, UnauthorizedError } from '@/shared/errors/app-error';
import type { User } from '@/modules/auth/domain/entities/user.entity';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';
import type { UserConsentRepository } from '@/modules/legal/domain/repositories/user-consent.repository';
import type { RegionRepository } from '@/modules/region/domain/repositories/region.repository';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import type { NotifyUserUseCase } from '@/modules/device/application/use-cases/notify-user.use-case';
import type { UpdateMyProfileDto } from '../dto/update-my-profile.dto';
import type { PublicUserRepository } from '../../domain/repositories/public-user.repository';
import type { PublicProfileLeveling } from '../../domain/entities/public-profile.entity';
import { buildLeveling } from '@/modules/leveling/domain/leveling';

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
  leveling: PublicProfileLeveling;
  notifyStreakReminder: boolean;
  notifyLevelUp: boolean;
}

function toMyProfile(
  user: User,
  requiresConsent: boolean,
  leveling: PublicProfileLeveling,
): MyProfileResult {
  return {
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    regionId: user.regionId,
    villageId: user.villageId,
    avatarUrl: user.avatarUrl,
    hasReadContributionGuide: user.readContributionGuideAt !== null,
    requiresConsent,
    leveling,
    notifyStreakReminder: user.notifyStreakReminder,
    notifyLevelUp: user.notifyLevelUp,
  };
}

export class GetMyProfileUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly settingsRepo?: AppSettingsRepository,
    private readonly consentRepo?: UserConsentRepository,
    private readonly publicUserRepo?: PublicUserRepository,
    private readonly recordInbox?: RecordInboxNotificationUseCase,
    private readonly notifyUser?: NotifyUserUseCase,
  ) {}

  async execute(userId: string): Promise<MyProfileResult> {
    const user = await this.userRepo.findById(userId);
    if (!user || user.deletedAt || !user.isActive) {
      throw new UnauthorizedError('UNAUTHORIZED', 'Sesi tidak valid');
    }
    const requiresConsent = await this.computeRequiresConsent(userId);
    const leveling = this.publicUserRepo
      ? (await this.publicUserRepo.loadStats(userId)).leveling
      : buildLeveling({ points: 0, exploration: 0, accuracy: 0, depth: 0 });

    await this.maybeNotifyLevelUp(user, leveling);

    const refreshed =
      leveling.level > user.levelSeen
        ? ((await this.userRepo.findById(userId)) ?? user)
        : user;

    return toMyProfile(refreshed, requiresConsent, leveling);
  }

  /**
   * Naik level: inbox + FCM sekali, lalu level_seen = level.
   * Gagal notif tidak menggagalkan GET /me.
   */
  private async maybeNotifyLevelUp(
    user: User,
    leveling: PublicProfileLeveling,
  ): Promise<void> {
    if (leveling.level <= user.levelSeen) return;

    try {
      if (user.notifyLevelUp && this.recordInbox && this.notifyUser) {
        const title = 'Level kamu naik';
        const body = `Kamu sekarang Level ${leveling.level}. Buka profil untuk lihat progressnya.`;
        await this.recordInbox.execute({
          userId: user.id,
          type: 'level_up',
          targetKind: 'level',
          targetId: String(leveling.level),
          title,
          body,
          actionKind: 'url',
          actionValue: '/profile',
        });
        await this.notifyUser.execute({
          userId: user.id,
          title,
          body,
          data: {
            type: 'level_up',
            level: String(leveling.level),
          },
        });
      }
      await this.userRepo.updateProfile(user.id, {
        levelSeen: leveling.level,
      });
    } catch (err) {
      console.error(
        `[level-up] gagal user=${user.id} level=${leveling.level}:`,
        err instanceof Error ? err.message : err,
      );
    }
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
    private readonly publicUserRepo?: PublicUserRepository,
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
      ...(dto.notifyStreakReminder !== undefined
        ? { notifyStreakReminder: dto.notifyStreakReminder }
        : {}),
      ...(dto.notifyLevelUp !== undefined
        ? { notifyLevelUp: dto.notifyLevelUp }
        : {}),
    });

    const leveling = this.publicUserRepo
      ? (await this.publicUserRepo.loadStats(userId)).leveling
      : buildLeveling({ points: 0, exploration: 0, accuracy: 0, depth: 0 });
    return toMyProfile(updated, false, leveling);
  }
}
