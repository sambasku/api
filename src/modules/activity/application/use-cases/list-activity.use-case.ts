import { ValidationError } from '@/shared/errors/app-error';
import { applyBlocklistFilter } from '@/modules/comment-blocklist/application/utils/apply-blocklist-filter';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import type { ActivityItem } from '../../domain/entities/activity-item.entity';
import type { ActivityRepository } from '../../domain/repositories/activity.repository';
import {
  ACTIVITY_DEFAULT_LIMIT,
  ACTIVITY_PER_SOURCE,
  decodeActivityCursor,
  encodeActivityCursor,
  mergeActivityFeed,
  type ActivityCursor,
} from '../../domain/merge-activity';

const CONTRIB_ENTITY_TYPES = [
  'word_image',
  'word_audio',
  'pronunciation',
  'example',
] as const;

/** Kind dengan teks bebas user di body: disensor saat dibaca. */
const FREE_TEXT_KINDS = new Set(['comment', 'discussion']);

export type ListActivityPage = {
  items: ActivityItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

/**
 * Sensor ulang saat baca: menutup data lama + kata blocklist yang baru ditambah.
 * Search-miss yang kena blocklist dibuang (term = seluruh isi baris).
 */
export function censorFeedItems(items: ActivityItem[], blocked: string[]): ActivityItem[] {
  if (blocked.length === 0) return items;
  const out: ActivityItem[] = [];
  for (const item of items) {
    if (item.kind === 'search_miss') {
      if (applyBlocklistFilter(item.body, blocked) === item.body) out.push(item);
      continue;
    }
    out.push(
      FREE_TEXT_KINDS.has(item.kind)
        ? { ...item, body: applyBlocklistFilter(item.body, blocked) }
        : item,
    );
  }
  return out;
}

export type ListActivityInput = {
  limit?: number;
  cursor?: string;
  /** Buang baris milik user ini. `undefined` = feed publik utuh (tamu). */
  excludeUserId?: string;
};

export class ListActivityUseCase {
  constructor(
    private readonly activityRepo: ActivityRepository,
    private readonly blocklist?: Pick<CommentBlocklistRepository, 'listAllActiveWords'>,
  ) {}

  async execute(input: ListActivityInput): Promise<ListActivityPage> {
    const { limit = ACTIVITY_DEFAULT_LIMIT, cursor, excludeUserId } = input;

    let before: ActivityCursor | undefined;
    if (cursor) {
      try {
        before = decodeActivityCursor(cursor);
      } catch {
        throw new ValidationError([
          { field: 'cursor', message: 'Format cursor tidak valid' },
        ]);
      }
    }

    const perSource = ACTIVITY_PER_SOURCE;

    const [sources, blocked] = await Promise.all([
      Promise.all([
        this.activityRepo.listRecentWords(perSource, before, excludeUserId),
        this.activityRepo.listRecentComments(perSource, before, excludeUserId),
        this.activityRepo.listRecentVotes(perSource, before, excludeUserId),
        this.activityRepo.listRecentDiscussions(perSource, before, excludeUserId),
        this.activityRepo.listRecentApprovedContributions(
          [...CONTRIB_ENTITY_TYPES],
          perSource * CONTRIB_ENTITY_TYPES.length,
          before,
          excludeUserId,
        ),
        // Tanpa penyaringan: search-miss tidak punya kolom user (actor null).
        this.activityRepo.listRecentVisibleSearchMisses(perSource, before),
        this.activityRepo.listRecentWelcomes(perSource, before, excludeUserId),
        this.activityRepo.listRecentCardShares(perSource, before, excludeUserId),
        this.activityRepo.listRecentAppliedSuggestions(perSource, before, excludeUserId),
      ]),
      this.blocklist?.listAllActiveWords() ?? Promise.resolve([] as string[]),
    ]);

    // Sensor sebelum merge: search-miss yang dibuang tidak ikut memakan slot.
    const merged = mergeActivityFeed(censorFeedItems(sources.flat(), blocked), {
      limit: limit + 1,
      before,
    });

    const hasMore = merged.length > limit;
    const items = hasMore ? merged.slice(0, limit) : merged;
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeActivityCursor({ createdAt: last.createdAt, id: last.id })
        : null;

    return { items, nextCursor, hasMore };
  }
}
