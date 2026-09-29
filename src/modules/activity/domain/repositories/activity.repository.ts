import type { ActivityItem } from '../entities/activity-item.entity';
import type { ActivityCursor } from '../merge-activity';

/** Port agregasi sumber feed publik. */
export interface ActivityRepository {
  listRecentWords(
    limit: number,
    before?: ActivityCursor,
  ): Promise<ActivityItem[]>;
  listRecentComments(
    limit: number,
    before?: ActivityCursor,
  ): Promise<ActivityItem[]>;
  listRecentVotes(
    limit: number,
    before?: ActivityCursor,
  ): Promise<ActivityItem[]>;
  listRecentDiscussions(
    limit: number,
    before?: ActivityCursor,
  ): Promise<ActivityItem[]>;
  listRecentApprovedContributions(
    entityTypes: Array<'word_image' | 'word_audio' | 'pronunciation' | 'example'>,
    limit: number,
    before?: ActivityCursor,
  ): Promise<ActivityItem[]>;
  listRecentVisibleSearchMisses(
    limit: number,
    before?: ActivityCursor,
  ): Promise<ActivityItem[]>;
  /** Akun terverifikasi (setelah OTP / OAuth) - baris selamat datang. */
  listRecentWelcomes(
    limit: number,
    before?: ActivityCursor,
  ): Promise<ActivityItem[]>;
  listRecentCardShares(
    limit: number,
    before?: ActivityCursor,
  ): Promise<ActivityItem[]>;
  /** Usulan yang sudah tayang (disetujui, atau tayang dulu via baseline). */
  listRecentAppliedSuggestions(
    limit: number,
    before?: ActivityCursor,
  ): Promise<ActivityItem[]>;
  /** Catat share kartu; `duplicate` jika user+kata sudah tercatat dalam 24 jam. */
  recordCardShare(
    userId: string,
    wordId: string,
  ): Promise<'recorded' | 'duplicate' | 'word_not_found'>;
}
