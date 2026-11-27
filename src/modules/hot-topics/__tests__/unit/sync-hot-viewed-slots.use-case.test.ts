import { describe, it, expect, vi } from 'vitest';
import {
  HOT_VIEWED_ACTIVE_MS,
  HOT_VIEWED_COOLDOWN_MS,
  HOT_VIEWED_SLOTS_LAST_SYNC_KEY,
  SyncHotViewedSlotsUseCase,
} from '../../application/sync-hot-viewed-slots.use-case';
import type { HotTopicsRepository } from '../../domain/hot-topics.repository';
import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';

describe('SyncHotViewedSlotsUseCase (#372)', () => {
  it('melewati sync jika belum melewati interval 5 menit', async () => {
    const now = new Date('2026-11-27T08:00:00.000Z');
    const settingsRepo = {
      getValue: vi.fn().mockResolvedValue('2026-11-27T07:57:00.000Z'),
      upsertMany: vi.fn(),
    } as unknown as AppSettingsRepository;
    const repo = {
      pruneExpiredViewedSlots: vi.fn(),
      listActiveViewedCandidates: vi.fn(),
      recordViewedSlotEntries: vi.fn(),
    } as unknown as HotTopicsRepository;

    const uc = new SyncHotViewedSlotsUseCase(repo, undefined, settingsRepo);
    const res = await uc.execute(now);

    expect(res).toEqual({ ran: false, pruned: 0, recorded: 0 });
    expect(repo.pruneExpiredViewedSlots).not.toHaveBeenCalled();
    expect(repo.recordViewedSlotEntries).not.toHaveBeenCalled();
  });

  it('prune cooldown selesai, saring blocklist, lalu catat Top 10 dengan durasi 24j + cooldown 24j', async () => {
    const now = new Date('2026-11-27T08:00:00.000Z');
    const settingsRepo = {
      getValue: vi.fn().mockResolvedValue('2026-11-27T07:50:00.000Z'),
      upsertMany: vi.fn().mockResolvedValue(undefined),
    } as unknown as AppSettingsRepository;
    const pruneExpiredViewedSlots = vi.fn().mockResolvedValue(2);
    const listActiveViewedCandidates = vi.fn().mockResolvedValue({
      items: [
        { kind: 'word_view', wordId: 'w_spam', lemma: 'spam', viewCount: 20, lastViewedDay: '2026-11-27', inWindow: true },
        { kind: 'word_view', wordId: 'w_1', lemma: 'makatn', viewCount: 15, lastViewedDay: '2026-11-27', inWindow: true },
        { kind: 'word_view', wordId: 'w_2', lemma: 'nganga', viewCount: 10, lastViewedDay: '2026-11-27', inWindow: true },
      ],
      meta: { inWindow: 3, backfilled: 0, backfillUsed: false },
    });
    const recordViewedSlotEntries = vi.fn().mockResolvedValue(2);
    const repo = {
      pruneExpiredViewedSlots,
      listActiveViewedCandidates,
      recordViewedSlotEntries,
    } as unknown as HotTopicsRepository;
    const blocklist = {
      findActiveWordSet: vi.fn().mockResolvedValue(new Set(['spam'])),
    };

    const uc = new SyncHotViewedSlotsUseCase(repo, blocklist, settingsRepo);
    const res = await uc.execute(now);

    expect(res).toEqual({ ran: true, pruned: 2, recorded: 2 });
    expect(pruneExpiredViewedSlots).toHaveBeenCalledWith(now);
    expect(recordViewedSlotEntries).toHaveBeenCalledWith(['w_1', 'w_2'], {
      enteredAt: now,
      expiresAt: new Date(now.getTime() + HOT_VIEWED_ACTIVE_MS),
      cooldownUntil: new Date(now.getTime() + HOT_VIEWED_ACTIVE_MS + HOT_VIEWED_COOLDOWN_MS),
    });
    expect(settingsRepo.upsertMany).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          key: HOT_VIEWED_SLOTS_LAST_SYNC_KEY,
          value: now.toISOString(),
        }),
      ],
      null,
    );
  });
});
