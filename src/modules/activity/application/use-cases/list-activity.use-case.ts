import { ValidationError } from '@/shared/errors/app-error';
import type { ActivityItem } from '../../domain/entities/activity-item.entity';
import {
  ACTIVITY_DEFAULT_LIMIT,
  decodeActivityCursor,
  encodeActivityCursor,
  type ActivityCursor,
} from '../../domain/merge-activity';
import type { ActivityEventFeedRepositoryImpl } from '../../infrastructure/activity-event-feed.repository.impl';

export type ListActivityPage = {
  items: ActivityItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type ListActivityInput = {
  limit?: number;
  cursor?: string;
  /** Buang baris milik user ini. `undefined` = feed publik utuh (tamu). */
  excludeUserId?: string;
};

export class ListActivityUseCase {
  constructor(
    private readonly eventFeedRepo: Pick<ActivityEventFeedRepositoryImpl, 'listFeed'>,
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

    // Sumber: activity_events (write-through log) - satu query menggantikan
    // agregasi 11 sumber (#86). Logika merge/censor/blocklist feed lama tidak
    // diperlukan lagi: visibility dicek read-time di repo event.
    const items = await this.eventFeedRepo.listFeed(limit + 1, before, excludeUserId);

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeActivityCursor({ createdAt: last.createdAt, id: last.id })
        : null;

    return { items: page, nextCursor, hasMore };
  }
}
