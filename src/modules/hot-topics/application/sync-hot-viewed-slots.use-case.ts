import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import { normalizeSearchMissTerm } from '@/modules/search-miss/domain/normalize-term';
import {
  passesSearchMissQualityGate,
  searchMissBlocklistTokens,
} from '@/modules/search-miss/domain/quality-gate';
import type { HotTopicsRepository } from '../domain/hot-topics.repository';

/** Key app_settings: kapan sync slot Top 10 HITS terakhir jalan (ISO 8601). */
export const HOT_VIEWED_SLOTS_LAST_SYNC_KEY = 'hot_viewed_slots_last_sync_at';

/** Interval sync cron: 5 menit. */
export const HOT_VIEWED_SLOTS_SYNC_INTERVAL_MS = 5 * 60 * 1000;
/** Durasi default kata boleh bertengger di Top 10 HITS: 24 jam. */
export const HOT_VIEWED_ACTIVE_MS = 24 * 60 * 60 * 1000;
/** Durasi cooldown setelah masa tayang 24 jam berakhir: 24 jam. */
export const HOT_VIEWED_COOLDOWN_MS = 24 * 60 * 60 * 1000;
/** Jumlah slot Top 10 HITS yang dicatat timer-nya. */
export const HOT_VIEWED_TOP_LIMIT = 10;

export interface SyncHotViewedSlotsResult {
  ran: boolean;
  pruned: number;
  recorded: number;
}

/**
 * Cron sinkronisasi slot Top 10 HITS (`viewed`, #372):
 * 1. Due-check interval 5 menit via `app_settings` (hemat subrequest cron per-menit).
 * 2. Hapus baris `hot_viewed_slots` yang `cooldown_until <= now`.
 * 3. Ambil kandidat aktif (non-cooldown) Top 10 + filter blocklist/quality gate.
 * 4. Catat kata yang baru masuk Top 10 (`ON CONFLICT DO NOTHING` - tidak reset
 *    `entered_at` kata yang masih aktif tayang).
 */
export class SyncHotViewedSlotsUseCase {
  constructor(
    private readonly repo: HotTopicsRepository,
    private readonly blocklist?: Pick<CommentBlocklistRepository, 'findActiveWordSet'>,
    private readonly settingsRepo: AppSettingsRepository | null = null,
  ) {}

  async execute(
    now: Date = new Date(),
    opts?: { force?: boolean },
  ): Promise<SyncHotViewedSlotsResult> {
    if (!opts?.force && this.settingsRepo) {
      const lastRaw = await this.settingsRepo.getValue(HOT_VIEWED_SLOTS_LAST_SYNC_KEY);
      if (lastRaw) {
        const last = new Date(lastRaw);
        if (
          !Number.isNaN(last.getTime()) &&
          now.getTime() - last.getTime() < HOT_VIEWED_SLOTS_SYNC_INTERVAL_MS
        ) {
          return { ran: false, pruned: 0, recorded: 0 };
        }
      }
    }

    const pruned = (await this.repo.pruneExpiredViewedSlots?.(now)) ?? 0;

    const raw = this.repo.listActiveViewedCandidates
      ? await this.repo.listActiveViewedCandidates(HOT_VIEWED_TOP_LIMIT, now)
      : (await this.repo.listAllTabs(HOT_VIEWED_TOP_LIMIT, now)).viewed;

    const tokenSet = new Set<string>();
    for (const item of raw.items) {
      const normalized = normalizeSearchMissTerm(item.lemma);
      if (!normalized) continue;
      for (const token of searchMissBlocklistTokens(normalized)) {
        tokenSet.add(token);
      }
    }

    const blocked =
      this.blocklist && tokenSet.size > 0
        ? await this.blocklist.findActiveWordSet([...tokenSet])
        : new Set<string>();

    const safeTopIds = raw.items
      .filter((item) => {
        const normalized = normalizeSearchMissTerm(item.lemma);
        if (!normalized) return false;
        if (!passesSearchMissQualityGate(normalized)) return false;
        const tokens = searchMissBlocklistTokens(normalized);
        return !tokens.some((t) => blocked.has(t));
      })
      .slice(0, HOT_VIEWED_TOP_LIMIT)
      .map((item) => item.wordId);

    const expiresAt = new Date(now.getTime() + HOT_VIEWED_ACTIVE_MS);
    const cooldownUntil = new Date(expiresAt.getTime() + HOT_VIEWED_COOLDOWN_MS);
    const recorded =
      (await this.repo.recordViewedSlotEntries?.(safeTopIds, {
        enteredAt: now,
        expiresAt,
        cooldownUntil,
      })) ?? 0;

    if (this.settingsRepo) {
      await this.settingsRepo.upsertMany(
        [
          {
            key: HOT_VIEWED_SLOTS_LAST_SYNC_KEY,
            value: now.toISOString(),
            type: 'string',
            description: 'Waktu sinkronisasi slot Top 10 HITS terakhir (cron)',
          },
        ],
        null,
      );
    }

    return { ran: true, pruned, recorded };
  }
}
