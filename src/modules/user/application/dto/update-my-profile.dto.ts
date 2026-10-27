export interface UpdateMyProfileDto {
  displayName?: string;
  bio?: string | null;
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
