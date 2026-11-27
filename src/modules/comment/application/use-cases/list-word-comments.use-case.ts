import type { VoteRepository } from '@/modules/vote/domain/repositories/vote.repository';
import { attachCommentRepliesTwoLevel } from '@/shared/comment/comment-threading';
import type { Comment } from '../../domain/entities/comment.entity';
import type { CommentRepository } from '../../domain/repositories/comment.repository';

export interface CommentWithVotes extends Comment {
  upvotes: number;
  downvotes: number;
  replies?: CommentWithVotes[];
}

export interface ListWordCommentsResult {
  items: CommentWithVotes[];
  nextCursor: string | null;
  hasMore: boolean;
}

// List komentar PUBLISHED pada sebuah kata (09-api-comment.md) - publik,
// terbaru dulu untuk top-level, balasan 1 level kronologis naik.
// Batch replies + batch vote counts (tanpa N+1).
export class ListWordCommentsUseCase {
  constructor(
    private readonly commentRepo: CommentRepository,
    private readonly voteRepo: VoteRepository,
  ) {}

  async execute(wordId: string, params: { limit: number; cursor?: string }): Promise<ListWordCommentsResult> {
    const page = await this.commentRepo.listByWord(wordId, params);
    const topIds = page.items.map((c) => c.id);
    const rawReplies =
      topIds.length > 0 && typeof this.commentRepo.listRepliesByParentIds === 'function'
        ? await this.commentRepo.listRepliesByParentIds(topIds)
        : [];

    const allIds = [...topIds, ...rawReplies.map((r) => r.id)];
    const counts =
      allIds.length > 0
        ? await this.voteRepo.countMany(
            allIds.map((id) => ({ entityType: 'comment' as const, entityId: id })),
          )
        : new Map<string, { upvotes: number; downvotes: number }>();

    const withVotes = (c: Comment): CommentWithVotes => {
      const v = counts.get(`comment:${c.id}`) ?? { upvotes: 0, downvotes: 0 };
      return { ...c, upvotes: v.upvotes, downvotes: v.downvotes };
    };

    const nested = attachCommentRepliesTwoLevel(
      page.items.map(withVotes),
      rawReplies.map(withVotes),
    );

    return {
      items: nested,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    };
  }
}
