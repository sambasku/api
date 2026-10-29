import type { VoteRepository } from '@/modules/vote/domain/repositories/vote.repository';
import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type { Discussion } from '../../domain/entities/discussion.entity';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';

export interface DiscussionWithListCounts extends Discussion {
  upvotes: number;
  replyCount: number;
}

export class ListPublishedDiscussionsUseCase {
  constructor(
    private readonly repo: DiscussionRepository,
    private readonly voteRepo: VoteRepository,
  ) {}

  async execute(input: {
    limit: number;
    cursor?: string;
    sort?: 'latest' | 'popular';
  }): Promise<CursorPage<DiscussionWithListCounts>> {
    const sort = input.sort ?? 'latest';
    const page = await this.repo.list({
      status: 'published',
      limit: input.limit,
      cursor: input.cursor,
      sort,
    });

    const ids = page.items.map((h) => h.id);
    const [counts, replyCounts] = await Promise.all([
      this.voteRepo.countMany(
        ids.map((id) => ({
          entityType: 'discussion' as const,
          entityId: id,
        })),
      ),
      this.repo.countPublishedRepliesByDiscussionIds(ids),
    ]);

    return {
      items: page.items.map((h) => {
        const v = counts.get(`discussion:${h.id}`) ?? { upvotes: 0, downvotes: 0 };
        return {
          ...h,
          upvotes: v.upvotes,
          replyCount: replyCounts.get(h.id) ?? 0,
        };
      }),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    };
  }
}
