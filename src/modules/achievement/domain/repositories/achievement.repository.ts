import type {
  Achievement,
  AchievementCandidate,
  AchievementCriteria,
  AchievementWithOwnership,
  CreateAchievementInput,
  ListAchievementsFilter,
  ListAchievementsResult,
  UpdateAchievementInput,
} from '../entities/achievement.entity';

/**
 * Satu baris katalog + reward dimiliki (dipakai scan untuk tahu apa yang
 * belum diberikan). `alreadyAwarded` diisi read-time, bukan kolom.
 */
export interface AwardTarget {
  achievementId: string;
  userId: string;
  username: string;
  displayName: string;
  matchedAt: Date;
  /** Snapshot context saat award (mis. registered_at). */
  context: Record<string, unknown> | null;
}

export interface GrantResult {
  awarded: number;
  /** User yang sudah punya award (dilewati, idempotent). */
  skipped: number;
  /** Username yang tidak ditemukan / tidak valid. */
  missing: string[];
}

export interface AchievementRepository {
  // ---- katalog ----
  create(input: CreateAchievementInput & { actorId: string }): Promise<Achievement>;
  update(input: UpdateAchievementInput & { actorId: string }): Promise<Achievement | null>;
  softDelete(id: string, actorId: string): Promise<boolean>;
  findById(id: string): Promise<Achievement | null>;
  findByCode(code: string): Promise<Achievement | null>;
  /** Katalog aktif saja (endpoint publik). */
  listActive(filter: Omit<ListAchievementsFilter, 'onlyActive'>): Promise<ListAchievementsResult>;
  /** Katalog apa pun (admin console) + jumlah penerima per baris. */
  listAdmin(filter: ListAchievementsFilter): Promise<{
    items: Array<Achievement & { recipientCount: number }>;
    nextCursor: string | null;
    hasMore: boolean;
  }>;
  /**
   * Semua katalog aktif untuk cron scan (tanpa hard-cap page 50, tanpa
   * hitung penerima). ACHIEVEMENT_ENHANCEMENT Q2.
   */
  listActiveForScan(): Promise<Achievement[]>;

  // ---- kepemilikan ----
  /** Katalog + status kepemilikan user (locked/owned) dalam SATU query. */
  listForUser(
    userId: string,
    filter: Omit<ListAchievementsFilter, 'onlyActive'>,
  ): Promise<ListAchievementsResult>;
  /** Reward yang sudah dimiliki user (profil publik). */
  listOwnedByUser(userId: string): Promise<AchievementWithOwnership[]>;
  /** Award id milik user untuk satu achievement; null = belum punya. */
  findAwardId(achievementId: string, userId: string): Promise<string | null>;
  /** Award + katalog milik user (validasi border aktif). */
  findOwnedAwardById(
    userId: string,
    awardId: string,
  ): Promise<{ awardId: string; code: string; rewardType: string } | null>;
  /** Resolve username (lowercase) -> user aktif; satu query IN. */
  resolveUsernames(
    usernames: string[],
  ): Promise<Map<string, { id: string; username: string; displayName: string }>>;
  /** Insert award; idempotent (UNIQUE) - return false bila sudah ada. */
  insertAward(target: AwardTarget, grantedVia: 'scan' | 'admin'): Promise<boolean>;
  /**
   * Insert banyak award dalam SATU statement (hindari N+1 write saat scan
   * batch: 1 subrequest, bukan 1 per user). Idempotent lewat UNIQUE +
   * onConflictDoNothing; return baris yang benar-benar baru dibuat.
   */
  insertAwards(
    targets: AwardTarget[],
    grantedVia: 'scan' | 'admin',
  ): Promise<Array<{ id: string; userId: string }>>;
  /** Revoke (soft delete) satu baris award. */
  revokeAward(awardId: string, actorId: string): Promise<boolean>;
  /** Jumlah penerima per achievement (console list). */
  countRecipients(achievementId: string): Promise<number>;
  /**
   * Daftar penerima (award id + identitas) untuk revoke di console.
   * Satu JOIN, cursor ULID - bukan N+1.
   */
  listRecipients(
    achievementId: string,
    limit: number,
    before?: string,
  ): Promise<{
    items: Array<{
      awardId: string;
      userId: string;
      username: string;
      displayName: string;
      awardedAt: Date;
      grantedVia: string;
    }>;
    nextCursor: string | null;
    hasMore: boolean;
  }>;

  // ---- evaluasi ----
  /**
   * User yang memenuhi kriteria `criteria` dan BELUM punya award.
   * Satu statement anti-join per achievement (fixed per source).
   */
  findUnawardedCandidates(
    achievementId: string,
    criteria: AchievementCriteria,
    limit: number,
  ): Promise<AchievementCandidate[]>;
  /**
   * Idem untuk BANYAK achievement sekaligus dalam satu `db.batch` (1
   * roundtrip HTTP ke Turso, bukan 1 per katalog). Dipakai scan cron.
   */
  findUnawardedCandidatesBatch(
    items: Array<{ id: string; criteria: AchievementCriteria }>,
    limitPerAchievement: number,
  ): Promise<Map<string, AchievementCandidate[]>>;
  /** Idem, hanya hitung (preview tanpa menarik data pribadi berlebih). */
  countUnawardedCandidates(
    achievementId: string,
    criteria: AchievementCriteria,
  ): Promise<number>;
  /**
   * Progress satu user untuk banyak criteria agregat (1 db.batch).
   * Index hasil = index input. Source non-agregat → 0.
   */
  countUserAggregateProgressBatch(
    userId: string,
    criteriaList: AchievementCriteria[],
  ): Promise<number[]>;

  // ---- border profil ----
  /** Set/lepas border aktif. null = tanpa border. */
  setActiveBorder(userId: string, awardId: string | null): Promise<void>;
  /** Border yang sedang dipakai beserta URL aset (profil publik, satu query). */
  findActiveBorder(userId: string): Promise<{ awardId: string; achievementId: string; code: string; title: string; badgeUrl: string | null } | null>;
}
