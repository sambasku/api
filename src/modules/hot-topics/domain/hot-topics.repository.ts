import type { HotTopicTabMeta, HotTopicsResult, HotViewedItem } from './hot-topic.entity';

export interface HotTopicsRepository {
  /** Satu panggilan: enam tab, masing-masing <= limit, tanpa duplikat. */
  listAllTabs(limit: number, now?: Date): Promise<HotTopicsResult>;

  /**
   * Ambil kandidat tab `viewed` (HITS) yang TIDAK sedang cooldown
   * untuk sinkronisasi slot Top 10 (#372). Satu query (bukan 6 tab).
   */
  listActiveViewedCandidates?(
    limit: number,
    now?: Date,
  ): Promise<{ items: HotViewedItem[]; meta: HotTopicTabMeta }>;

  /** Hapus baris `hot_viewed_slots` yang cooldown-nya sudah selesai (`cooldown_until <= now`). */
  pruneExpiredViewedSlots?(now: Date): Promise<number>;

  /**
   * Catat kata baru yang masuk Top 10 HITS (`ON CONFLICT DO NOTHING` supaya
   * `entered_at` kata yang masih aktif tidak ter-reset).
   */
  recordViewedSlotEntries?(
    wordIds: string[],
    opts: { enteredAt: Date; expiresAt: Date; cooldownUntil: Date },
  ): Promise<number>;
}
