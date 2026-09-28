import type { ActivityItem, ActivityKind } from './entities/activity-item.entity';

/** Ambil per sumber sebelum merge (cukup untuk cap + limit). */
export const ACTIVITY_PER_SOURCE = 8;

/** Cap per kind agar feed tidak didominasi satu jenis. */
export const ACTIVITY_PER_KIND_CAP = 4;

/** Batas default response. */
export const ACTIVITY_DEFAULT_LIMIT = 20;

export const ACTIVITY_MAX_LIMIT = 50;

function compareNewestFirst(a: ActivityItem, b: ActivityItem): number {
  const byTime = b.createdAt.getTime() - a.createdAt.getTime();
  if (byTime !== 0) return byTime;
  return b.id.localeCompare(a.id);
}

/**
 * Sort waktu desc → dedupe by id → cap per kind → top [limit].
 */
export function mergeActivityFeed(
  items: Iterable<ActivityItem>,
  options?: { perKindCap?: number; limit?: number },
): ActivityItem[] {
  const perKindCap = options?.perKindCap ?? ACTIVITY_PER_KIND_CAP;
  const limit = options?.limit ?? ACTIVITY_DEFAULT_LIMIT;

  const sorted = [...items].sort(compareNewestFirst);

  const seen = new Set<string>();
  const counts = new Map<ActivityKind, number>();
  const out: ActivityItem[] = [];

  for (const item of sorted) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);

    const n = counts.get(item.kind) ?? 0;
    if (n >= perKindCap) continue;
    counts.set(item.kind, n + 1);
    out.push(item);
    if (out.length >= limit) break;
  }

  return out;
}
