import type { ActivityItem, ActivityKind } from './entities/activity-item.entity';
import type { ActivityEventKind } from './entities/activity-event.entity';

/**
 * #193: kategori chips feed beranda -> kind event DB.
 *
 * `null` = TANPA filter (kategori "Semua") - JANGAN `[]`. Repo memakai
 * `kinds.length > 0` sebelum menambah kondisi SQL, jadi array kosong
 * berarti filter MATI diam-diam: `category=announcement` akan balikkan
 * seluruh feed. Test unit mengunci nilai `all === null`.
 *
 * "Perbaikan" = kontribusi non-kata + usulan edit, sejalan definisi
 * `correctionsApproved` di profil publik (semua entity_type selain 'word').
 */
export type FeedCategory =
  | 'all'
  | 'search_miss'
  | 'correction'
  | 'announcement'
  | 'joined';

export const FEED_CATEGORY_KINDS: Record<
  FeedCategory,
  ActivityEventKind[] | null
> = {
  all: null,
  search_miss: ['search_miss'],
  correction: [
    'contribution_image',
    'contribution_audio',
    'contribution_pron',
    'contribution_example',
    'suggestion_created',
    'suggestion_applied',
    'suggestion_selfapply',
    'place_photo_added',
  ],
  announcement: ['announcement'],
  joined: ['user_joined'],
};

/** Ambil per sumber sebelum merge (cukup untuk cap + limit). */
export const ACTIVITY_PER_SOURCE = 8;

/** Cap per kind agar feed tidak didominasi satu jenis. */
export const ACTIVITY_PER_KIND_CAP = 4;

/** Batas default response. */
export const ACTIVITY_DEFAULT_LIMIT = 20;

export const ACTIVITY_MAX_LIMIT = 50;

/** Keyset halaman berikutnya: item terakhir response sebelumnya. */
export type ActivityCursor = {
  createdAt: Date;
  /** Id aktivitas penuh, mis. `comment:01…`. */
  id: string;
};

export function encodeActivityCursor(c: ActivityCursor): string {
  return Buffer.from(`${c.createdAt.toISOString()}\n${c.id}`, 'utf8').toString(
    'base64url',
  );
}

/** Decode cursor opaque. Lempar Error generik jika rusak (use case → ValidationError). */
export function decodeActivityCursor(s: string): ActivityCursor {
  const raw = Buffer.from(s, 'base64url').toString('utf8');
  const nl = raw.indexOf('\n');
  if (nl < 1) throw new Error('INVALID_CURSOR_FORMAT');
  const iso = raw.slice(0, nl);
  const id = raw.slice(nl + 1).trim();
  if (!id) throw new Error('INVALID_CURSOR_FORMAT');
  const createdAt = new Date(iso);
  if (Number.isNaN(createdAt.getTime())) throw new Error('INVALID_CURSOR_DATE');
  return { createdAt, id };
}

function compareNewestFirst(a: ActivityItem, b: ActivityItem): number {
  const byTime = b.createdAt.getTime() - a.createdAt.getTime();
  if (byTime !== 0) return byTime;
  return b.id.localeCompare(a.id);
}

/** True jika item lebih lama dari cursor (urut DESC: waktu, lalu id). */
export function isStrictlyOlderThan(
  item: ActivityItem,
  cursor: ActivityCursor,
): boolean {
  const byTime = cursor.createdAt.getTime() - item.createdAt.getTime();
  if (byTime !== 0) return byTime > 0;
  return cursor.id.localeCompare(item.id) > 0;
}

/**
 * Sort waktu desc → dedupe by id → (opsional) filter before cursor →
 * cap per kind → top [limit].
 */
export function mergeActivityFeed(
  items: Iterable<ActivityItem>,
  options?: {
    perKindCap?: number;
    limit?: number;
    before?: ActivityCursor;
  },
): ActivityItem[] {
  const perKindCap = options?.perKindCap ?? ACTIVITY_PER_KIND_CAP;
  const limit = options?.limit ?? ACTIVITY_DEFAULT_LIMIT;
  const before = options?.before;

  const sorted = [...items].sort(compareNewestFirst);

  const seen = new Set<string>();
  const counts = new Map<ActivityKind, number>();
  const out: ActivityItem[] = [];

  for (const item of sorted) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);

    if (before && !isStrictlyOlderThan(item, before)) continue;

    const n = counts.get(item.kind) ?? 0;
    if (n >= perKindCap) continue;
    counts.set(item.kind, n + 1);
    out.push(item);
    if (out.length >= limit) break;
  }

  return out;
}
