import type { ActivityItem } from '../entities/activity-item.entity';

/** Port agregasi sumber feed publik. */
export interface ActivityRepository {
  listRecentWords(limit: number): Promise<ActivityItem[]>;
  listRecentComments(limit: number): Promise<ActivityItem[]>;
  listRecentVotes(limit: number): Promise<ActivityItem[]>;
  listRecentDiscussions(limit: number): Promise<ActivityItem[]>;
  listRecentApprovedContributions(
    entityTypes: Array<'word_image' | 'word_audio' | 'pronunciation' | 'example'>,
    limit: number,
  ): Promise<ActivityItem[]>;
  listRecentVisibleSearchMisses(limit: number): Promise<ActivityItem[]>;
}
