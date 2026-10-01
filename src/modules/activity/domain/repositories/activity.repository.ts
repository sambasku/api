import type { ActivityItem } from '../entities/activity-item.entity';
import type { ActivityCursor } from '../merge-activity';

/**
 * Port agregasi sumber feed publik.
 *
 * `excludeUserId` (opsional, semua sumber): buang baris milik user tersebut
 * ("feed beranda jangan tampilkan karya sendiri"). WAJIB difilter di SQL, bukan
 * setelah baris masuk memory: `mergeActivityFeed` capping 4 per jenis di atas
 * pool yang tiap sumbernya cuma ambil 8 baris. Kalau penyaringan belakangan,
 * 4 baris milik sendiri masih memakan slot jenis itu dan jenisnya hilang dari
 * halaman - baris yang terbuang tidak bisa di-backfill karena `limit` sudah
 * terpakai di query.
 */
export interface ActivityRepository {
  listRecentWords(
    limit: number,
    before?: ActivityCursor,
    excludeUserId?: string,
  ): Promise<ActivityItem[]>;
  listRecentComments(
    limit: number,
    before?: ActivityCursor,
    excludeUserId?: string,
  ): Promise<ActivityItem[]>;
  listRecentVotes(
    limit: number,
    before?: ActivityCursor,
    excludeUserId?: string,
  ): Promise<ActivityItem[]>;
  listRecentDiscussions(
    limit: number,
    before?: ActivityCursor,
    excludeUserId?: string,
  ): Promise<ActivityItem[]>;
  listRecentApprovedContributions(
    entityTypes: Array<'word_image' | 'word_audio' | 'pronunciation' | 'example'>,
    limit: number,
    before?: ActivityCursor,
    excludeUserId?: string,
  ): Promise<ActivityItem[]>;
  listRecentVisibleSearchMisses(
    limit: number,
    before?: ActivityCursor,
  ): Promise<ActivityItem[]>;
  /** Akun terverifikasi (setelah OTP / OAuth) - baris selamat datang. */
  listRecentWelcomes(
    limit: number,
    before?: ActivityCursor,
    excludeUserId?: string,
  ): Promise<ActivityItem[]>;
  listRecentCardShares(
    limit: number,
    before?: ActivityCursor,
    excludeUserId?: string,
  ): Promise<ActivityItem[]>;
  /** Usulan yang sudah tayang (disetujui, atau tayang dulu via baseline). */
  listRecentAppliedSuggestions(
    limit: number,
    before?: ActivityCursor,
    excludeUserId?: string,
  ): Promise<ActivityItem[]>;
  /** Catat share kartu; `duplicate` jika user+kata sudah tercatat dalam 24 jam. */
  recordCardShare(
    userId: string,
    wordId: string,
  ): Promise<'recorded' | 'duplicate' | 'word_not_found'>;
}