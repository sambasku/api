import type { SpeakerStatus } from '@/modules/auth/domain/entities/user.entity';

export interface UpdateMyProfileDto {
  /** Handle publik. Field absen = tidak diubah. */
  username?: string;
  displayName?: string;
  bio?: string | null;
  /** Self-declare penutur/pembelajar. `null` mengosongkan. Field absen = tidak diubah. */
  speakerStatus?: SpeakerStatus | null;
  /** true = user tap "Mengerti" di guide swipe halaman kontribusi. */
  hasReadContributionGuide?: true;
  /** Id kecamatan. `null` mengosongkan. Field absen = tidak diubah. */
  regionId?: string | null;
  /** Id desa. `null` mengosongkan. Field absen = tidak diubah. */
  villageId?: string | null;
  /** Opt-in pengingat streak. */
  notifyStreakReminder?: boolean;
  /** Opt-in notifikasi naik level. */
  notifyLevelUp?: boolean;
}
