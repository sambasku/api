import type {
  MentionUserRow,
  PublicActivityPage,
  PublicProfileLeveling,
  PublicProfileStats,
  PublicUserRow,
} from '../entities/public-profile.entity';

export type PublicProfileStatsBundle = PublicProfileStats & {
  leveling: PublicProfileLeveling;
};

export interface PublicUserRepository {
  /**
   * Lookup exact match. Null jika tidak ada, soft-deleted, atau
   * is_active = false. SELECT hanya kolom publik.
   */
  findPublicByUsername(username: string): Promise<PublicUserRow | null>;

  /**
   * Suggest user untuk mention (autocomplete @username). Prefix-match,
   * hanya user aktif, belum soft-delete. Baris publik saja.
   */
  suggestByUsernamePrefix(prefix: string, limit: number): Promise<MentionUserRow[]>;

  loadStats(userId: string): Promise<PublicProfileStatsBundle>;

  /**
   * Gabungan sumber aktivitas publik. `limit` = ukuran halaman (repo fetch
   * limit+1 untuk deteksi hasMore); `cursor` = ULID terakhir (id < cursor).
   */
  listRecentApprovedContributions(
    userId: string,
    params: { limit: number; cursor?: string },
  ): Promise<PublicActivityPage>;
  listRecentPublishedComments(
    userId: string,
    params: { limit: number; cursor?: string },
  ): Promise<PublicActivityPage>;
  listRecentVerifications(
    userId: string,
    params: { limit: number; cursor?: string },
  ): Promise<PublicActivityPage>;
  /** Vote user ke word/comment yang masih feed-visible (26-api-my-votes). */
  listRecentVotes(
    userId: string,
    params: { limit: number; cursor?: string },
  ): Promise<PublicActivityPage>;
}
