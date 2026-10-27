import type {
  AchievementCategory,
  RewardType,
} from '@/shared/database/drizzle/schema/achievements.schema';

/**
 * Grammar kriteria achievement (registry-driven, bukan expression language).
 *
 * Semantik: user memenuhi kriteria = agregat `source`-nya (dalam `window`,
 * dengan `filters`) >= `threshold`; atau untuk kohort tanpa threshold, user
 * masuk himpunan window. Source tak dikenal = konfigurasi ditolak.
 *
 * `source` adalah kunci registry (`achievement-registry.ts`), bukan nama
 * kolom bebas - SQL evaluator fixed + terindeks per source.
 */
export interface AchievementCriteria {
  /** Kunci registry: 'registration' | 'manual' | (source baru: 'quizzes_completed', ...) */
  source: string;
  /** Jumlah minimum; null/absen = tanpa ambang (kohort). */
  threshold?: number | null;
  /** Batas waktu [from, to) ISO 8601 dengan offset. Absen = sepanjang waktu. */
  window?: { from: string; to: string } | null;
  /** Modifier opsional per source, mis. { entity_type: 'word' }. */
  filters?: Record<string, string> | null;
}

/** Baris katalog `achievements` dalam bentuk domain. */
export interface Achievement {
  id: string;
  /** Slug stabil - dipakai integrasi, tidak berubah sembarangan. */
  code: string;
  title: string;
  description: string;
  category: AchievementCategory;
  rewardType: RewardType;
  /** Aset reward (jsDelivr): bingkai border / lencana / stiker. */
  badgeUrl: string | null;
  criteria: AchievementCriteria;
  /** Grup tier, mis. 'kata-disetujui'. Null = tanpa tier. */
  family: string | null;
  level: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

/** Fakta penganugerahan: user memiliki reward. */
export interface UserAchievement {
  id: string;
  achievementId: string;
  userId: string;
  awardedAt: Date;
  grantedVia: 'scan' | 'admin';
  /** Snapshot saat award, mis. { registered_at: '...' }. */
  context: Record<string, unknown> | null;
}

/** Progres locked untuk source agregat (GET /me/achievements). */
export interface AchievementProgress {
  current: number;
  target: number;
}

/** Baris katalog + status kepemilikan (endpoint `me` dan profil publik). */
export interface AchievementWithOwnership extends Achievement {
  /** Award id; null = belum dimiliki (locked). */
  userAchievementId: string | null;
  awardedAt: Date | null;
  /** Border ini sedang dipakai user (dari `users.active_border_id`). */
  isActiveBorder?: boolean;
  /**
   * Hanya `/me` + locked + source agregat. Null = kohort/manual/sudah owned
   * / profil publik.
   */
  progress?: AchievementProgress | null;
}

/** Pemenuh kriteria untuk preview / backfill. */
export interface AchievementCandidate {
  userId: string;
  username: string;
  displayName: string;
  /** Waktu yang dipakai kriteria, mis. created_at untuk source registration. */
  matchedAt: Date;
}

/** Input create/update katalog. */
export interface CreateAchievementInput {
  code: string;
  title: string;
  description: string;
  category: AchievementCategory;
  rewardType: RewardType;
  badgeUrl: string | null;
  criteria: AchievementCriteria;
  family: string | null;
  level: number | null;
  isActive: boolean;
}

export type UpdateAchievementInput = Partial<Omit<CreateAchievementInput, 'code'>> & {
  id: string;
};

export interface ListAchievementsFilter {
  rewardType?: RewardType;
  category?: AchievementCategory;
  /** true = hanya katalog aktif; false = semua (admin). */
  onlyActive?: boolean;
  limit: number;
  before?: string;
}

export interface ListAchievementsResult {
  items: AchievementWithOwnership[];
  nextCursor: string | null;
  hasMore: boolean;
}
