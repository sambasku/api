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

    // Mode merge: 1 query 'merged' (#103) - repo sudah ORDER BY desc global,
    // sort+slice 4 kategori tidak diperlukan lagi. Tanpa cursor (kontrak lama).
    const page = await this.eventFeedRepo.listPublicByActor(
      user.id,
      'merged',
      limit,
    );
    return { items: page.items };
  }
}
