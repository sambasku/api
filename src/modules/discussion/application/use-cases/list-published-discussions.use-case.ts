import type { VoteRepository } from '@/modules/vote/domain/repositories/vote.repository';
import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type { Discussion } from '../../domain/entities/discussion.entity';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';

export interface DiscussionWithUpvotes extends Discussion {
  upvotes: number;
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
  }): Promise<CursorPage<DiscussionWithUpvotes>> {
    const sort = input.sort ?? 'latest';
    const page = await this.repo.list({
      status: 'published',
      limit: input.limit,
      cursor: input.cursor,
      sort,
    });

    const counts = await this.voteRepo.countMany(
      page.items.map((h) => ({
        entityType: 'discussion' as const,
        entityId: h.id,
      })),
    );

    return {
      items: page.items.map((h) => {
        const v = counts.get(`discussion:${h.id}`) ?? { upvotes: 0, downvotes: 0 };
        return { ...h, upvotes: v.upvotes };
      }),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    };
  }
}
