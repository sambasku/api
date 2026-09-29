import { ValidationError } from '@/shared/errors/app-error';
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

export type ListActivityPage = {
  items: ActivityItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

export class ListActivityUseCase {
  constructor(private readonly activityRepo: ActivityRepository) {}

  async execute(
    limit = ACTIVITY_DEFAULT_LIMIT,
    cursor?: string,
  ): Promise<ListActivityPage> {
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

    const [words, comments, votes, discussions, contributions, searchMisses, welcomes] =
      await Promise.all([
        this.activityRepo.listRecentWords(perSource, before),
        this.activityRepo.listRecentComments(perSource, before),
        this.activityRepo.listRecentVotes(perSource, before),
        this.activityRepo.listRecentDiscussions(perSource, before),
        this.activityRepo.listRecentApprovedContributions(
          [...CONTRIB_ENTITY_TYPES],
          perSource * CONTRIB_ENTITY_TYPES.length,
          before,
        ),
        this.activityRepo.listRecentVisibleSearchMisses(perSource, before),
        this.activityRepo.listRecentWelcomes(perSource, before),
      ]);

    const merged = mergeActivityFeed(
      [
        ...words,
        ...comments,
        ...votes,
        ...discussions,
        ...contributions,
        ...searchMisses,
        ...welcomes,
      ],
      { limit: limit + 1, before },
    );

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
