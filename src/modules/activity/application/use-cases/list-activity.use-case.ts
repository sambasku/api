import type { ActivityItem } from '../../domain/entities/activity-item.entity';
import type { ActivityRepository } from '../../domain/repositories/activity.repository';
import {
  ACTIVITY_DEFAULT_LIMIT,
  ACTIVITY_PER_SOURCE,
  mergeActivityFeed,
} from '../../domain/merge-activity';

const CONTRIB_ENTITY_TYPES = [
  'word_image',
  'word_audio',
  'pronunciation',
  'example',
] as const;

export class ListActivityUseCase {
  constructor(private readonly activityRepo: ActivityRepository) {}

  async execute(limit = ACTIVITY_DEFAULT_LIMIT): Promise<ActivityItem[]> {
    const perSource = ACTIVITY_PER_SOURCE;

    const [words, comments, votes, discussions, contributions, searchMisses] =
      await Promise.all([
        this.activityRepo.listRecentWords(perSource),
        this.activityRepo.listRecentComments(perSource),
        this.activityRepo.listRecentVotes(perSource),
        this.activityRepo.listRecentDiscussions(perSource),
        this.activityRepo.listRecentApprovedContributions(
          [...CONTRIB_ENTITY_TYPES],
          perSource * CONTRIB_ENTITY_TYPES.length,
        ),
        this.activityRepo.listRecentVisibleSearchMisses(perSource),
      ]);

    return mergeActivityFeed(
      [...words, ...comments, ...votes, ...discussions, ...contributions, ...searchMisses],
      { limit },
    );
  }
}
