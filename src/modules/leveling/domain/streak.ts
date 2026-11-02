/**
 * Streak consecutive WIB + 1 hari grace.
 * Spek: docs/LEVELING_AND_STREAK_IMPLEMENT.md §8
 */

/** Kind activity_events yang mengisi hari aktif streak. */
export const STREAK_ACTIVITY_KINDS = [
  'contribution_submitted',
  'suggestion_created',
  'suggestion_selfapply',
  'suggestion_applied',
  'word_created',
  'word_verified',
  'contribution_image',
  'contribution_audio',
  'contribution_pron',
  'contribution_example',
  'place_photo_added',
  'usaha_published',
  'cuisine_published',
  'place_published',
  'event_published',
  'pantun_created',
  'pantun_reply_created',
  'discussion_created',
] as const;

export const STREAK_WINDOW_DAYS = 90;

/** Offset WIB dari UTC dalam jam. */
export const WIB_OFFSET_HOURS = 7;

/**
 * Tanggal kalender WIB `YYYY-MM-DD` dari epoch ms UTC.
 */
export function wibDateKey(epochMs: number): string {
  const shifted = new Date(epochMs + WIB_OFFSET_HOURS * 3600_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Mundur 1 hari kalender dari key `YYYY-MM-DD` (tanpa zona - key sudah WIB). */
export function prevDateKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const noonUtc = Date.UTC(y!, m! - 1, d!, 12, 0, 0);
  const prev = new Date(noonUtc - 24 * 3600_000);
  const ys = prev.getUTCFullYear();
  const ms = String(prev.getUTCMonth() + 1).padStart(2, '0');
  const ds = String(prev.getUTCDate()).padStart(2, '0');
  return `${ys}-${ms}-${ds}`;
}

/**
 * Hitung streak dari set hari aktif (key WIB).
 * - Hari dengan aktivitas: streak++
 * - Satu hari bolong: pakai grace, lanjut
 * - Dua hari bolong berurutan: stop
 */
export function computeStreakDays(
  activeDayKeys: ReadonlySet<string>,
  todayKey: string,
): number {
  if (activeDayKeys.size === 0) return 0;

  let streak = 0;
  let cursor = todayKey;
  let graceUsed = false;
  // Batasi iterasi window + sedikit buffer
  for (let i = 0; i < STREAK_WINDOW_DAYS + 2; i++) {
    if (activeDayKeys.has(cursor)) {
      streak += 1;
      graceUsed = false;
      cursor = prevDateKey(cursor);
      continue;
    }
    if (!graceUsed) {
      graceUsed = true;
      cursor = prevDateKey(cursor);
      continue;
    }
    break;
  }
  return streak;
}
