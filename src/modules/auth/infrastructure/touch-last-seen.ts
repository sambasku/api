import { and, eq, isNull, lt, or } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { users } from '@/shared/database/drizzle/schema';

/** Jendela throttle write per user (ms) - isolat Map + WHERE di SQL. */
export const LAST_SEEN_TOUCH_THROTTLE_MS = 5 * 60 * 1000;

/** Window "aktif belakangan" untuk dashboard COUNT. */
export const ONLINE_RECENTLY_WINDOW_MS = 15 * 60 * 1000;

/**
 * Touch last_seen_at secara hemat: skip jika baru di-touch di isolate ini,
 * lalu UPDATE conditional agar baris yang sudah segar tidak ditulis ulang.
 * Gagal diam-diam - jangan gagalkan request auth.
 */
export function createTouchLastSeen(db: AppDatabase): (userId: string) => Promise<void> {
  const lastTouchByUser = new Map<string, number>();

  return async (userId: string) => {
    const nowMs = Date.now();
    const prev = lastTouchByUser.get(userId);
    if (prev !== undefined && nowMs - prev < LAST_SEEN_TOUCH_THROTTLE_MS) {
      return;
    }
    lastTouchByUser.set(userId, nowMs);

    const now = new Date(nowMs);
    const threshold = new Date(nowMs - LAST_SEEN_TOUCH_THROTTLE_MS);

    try {
      await db
        .update(users)
        .set({ lastSeenAt: now })
        .where(
          and(
            eq(users.id, userId),
            isNull(users.deletedAt),
            or(isNull(users.lastSeenAt), lt(users.lastSeenAt, threshold)),
          ),
        );
    } catch {
      // Presence best-effort: jangan bubarkan request.
      lastTouchByUser.delete(userId);
    }
  };
}

export function onlineRecentlySince(now: Date = new Date()): Date {
  return new Date(now.getTime() - ONLINE_RECENTLY_WINDOW_MS);
}
