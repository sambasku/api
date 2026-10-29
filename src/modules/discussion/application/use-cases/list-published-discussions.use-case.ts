import type { VoteRepository } from '@/modules/vote/domain/repositories/vote.repository';
import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type {
  Discussion,
  DiscussionListOrder,
  DiscussionListSort,
} from '../../domain/entities/discussion.entity';
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
    sort?: DiscussionListSort;
    order?: DiscussionListOrder;
  }): Promise<CursorPage<DiscussionWithListCounts>> {
    const page = await this.repo.list({
      status: 'published',
      limit: input.limit,
      cursor: input.cursor,
      sort: input.sort ?? 'latest',
      order: input.order,
    });

    const ids = page.items.map((h) => h.id);
    const counts = await this.voteRepo.countMany(
      ids.map((id) => ({
        entityType: 'discussion' as const,
        entityId: id,
      })),
    );

    return {
      items: page.items.map((h) => {
        const v = counts.get(`discussion:${h.id}`) ?? { upvotes: 0, downvotes: 0 };
        return {
          ...h,
          upvotes: v.upvotes,
          // #204: pakai denorm published_reply_count (bukan batch COUNT).
          replyCount: h.publishedReplyCount ?? 0,
        };
      }),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    };
  }
}
