import { NotFoundError } from '@/shared/errors/app-error';
import type { PublicActivityItem } from '../../domain/entities/public-profile.entity';
import type { PublicActivityQueryInput } from './public-activity.types';
import type { PublicUserRepository } from '../../domain/repositories/public-user.repository';
import type { ActivityEventFeedRepositoryImpl } from '@/modules/activity/infrastructure/activity-event-feed.repository.impl';

const ACTIVITY_LIMIT = 20;

export type { PublicActivityQueryInput };

export interface PublicActivityPageResult {
  items: PublicActivityItem[];
  /** Terisi hanya saat mode terfilter (query.kind diberikan). Null = halaman terakhir. */
  nextCursor?: string | null;
}

export class GetPublicActivityUseCase {
  constructor(
    private readonly publicUserRepo: PublicUserRepository,
    private readonly eventFeedRepo: Pick<
      ActivityEventFeedRepositoryImpl,
      'listPublicByActor'
    >,
  ) {}

  async execute(
    username: string,
    query?: PublicActivityQueryInput,
  ): Promise<PublicActivityPageResult> {
    const user = await this.publicUserRepo.findPublicByUsername(username);
    if (!user) {
      throw new NotFoundError('USER_NOT_FOUND', 'User tidak ditemukan');
    }

    // Sumber: activity_events (#86) - timeline dibekukan pada momen kejadian.
    const limit = query?.limit ?? ACTIVITY_LIMIT;
    if (query?.kind) {
      const page = await this.eventFeedRepo.listPublicByActor(
        user.id,
        query.kind,
        limit,
        query.cursor,
      );
      return { items: page.items, nextCursor: page.nextCursor };
    }

    // Mode merge: 4 kategori lalu gabung terbaru (top 20 campuran, tanpa cursor).
    const [contributions, comments, verifications, votes] = await Promise.all([
      this.eventFeedRepo.listPublicByActor(user.id, 'contribution', limit),
      this.eventFeedRepo.listPublicByActor(user.id, 'comment', limit),
      this.eventFeedRepo.listPublicByActor(user.id, 'verification', limit),
      this.eventFeedRepo.listPublicByActor(user.id, 'vote', limit),
    ]);
    const items = [
      ...contributions.items,
      ...comments.items,
      ...verifications.items,
      ...votes.items,
    ]
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, limit);
    return { items };
  }
}
