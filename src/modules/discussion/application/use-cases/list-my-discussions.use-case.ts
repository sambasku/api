import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type {
  Discussion,
  DiscussionStatus,
} from '../../domain/entities/discussion.entity';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';

export interface DiscussionWithReplyCount extends Discussion {
  replyCount: number;
}

export class ListMyDiscussionsUseCase {
  constructor(private readonly repo: DiscussionRepository) {}

  async execute(input: {
    userId: string;
    status?: DiscussionStatus;
    limit: number;
    cursor?: string;
  }): Promise<CursorPage<DiscussionWithReplyCount>> {
    const page = await this.repo.list({
      userId: input.userId,
      status: input.status,
      limit: input.limit,
      cursor: input.cursor,
    });

    const replyCounts = await this.repo.countPublishedRepliesByDiscussionIds(
      page.items.map((h) => h.id),
    );

    return {
      items: page.items.map((h) => ({
        ...h,
        replyCount: replyCounts.get(h.id) ?? 0,
      })),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    };
  }
}
