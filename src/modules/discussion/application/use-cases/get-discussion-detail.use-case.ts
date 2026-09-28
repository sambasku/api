import type { VoteRepository } from '@/modules/vote/domain/repositories/vote.repository';
import { NotFoundError } from '@/shared/errors/app-error';
import type {
  Discussion,
  DiscussionReply,
} from '../../domain/entities/discussion.entity';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';

export interface DiscussionReplyWithVotes extends DiscussionReply {
  upvotes: number;
  downvotes: number;
}

export interface DiscussionWithUpvotes extends Discussion {
  upvotes: number;
}

export interface GetDiscussionDetailResult {
  discussion: DiscussionWithUpvotes;
  replies: DiscussionReplyWithVotes[];
}

/**
 * Detail publik: published untuk semua; owner boleh lihat pending/rejected/taken_down sendiri.
 * Admin memakai endpoint terpisah.
 *
 * Vote: pertanyaan = upvotes saja (upvote-only); balasan = up+down.
 * Urutan reply: pinned → net desc → created_at desc.
 */
export class GetDiscussionDetailUseCase {
  constructor(
    private readonly repo: DiscussionRepository,
    private readonly voteRepo: VoteRepository,
  ) {}

  async execute(input: {
    id: string;
    viewerUserId?: string | null;
    /** true = antrean admin, tampilkan semua status */
    asAdmin?: boolean;
  }): Promise<GetDiscussionDetailResult> {
    const help = await this.repo.findById(input.id);
    if (!help) {
      throw new NotFoundError('DISCUSSION_NOT_FOUND', 'Diskusi tidak ditemukan');
    }

    if (!input.asAdmin) {
      const isOwner = input.viewerUserId != null && help.userId === input.viewerUserId;
      if (help.status !== 'published' && !isOwner) {
        throw new NotFoundError('DISCUSSION_NOT_FOUND', 'Diskusi tidak ditemukan');
      }
    }

    const rawReplies =
      help.status === 'published' || input.asAdmin
        ? await this.repo.listReplies(help.id)
        : [];

    const voteTargets = [
      { entityType: 'discussion' as const, entityId: help.id },
      ...rawReplies.map((r) => ({
        entityType: 'discussion_reply' as const,
        entityId: r.id,
      })),
    ];
    const counts = await this.voteRepo.countMany(voteTargets);

    const helpVotes = counts.get(`discussion:${help.id}`) ?? {
      upvotes: 0,
      downvotes: 0,
    };

    const withVotes: DiscussionReplyWithVotes[] = rawReplies.map((r) => {
      const v = counts.get(`discussion_reply:${r.id}`) ?? {
        upvotes: 0,
        downvotes: 0,
      };
      return { ...r, upvotes: v.upvotes, downvotes: v.downvotes };
    });

    const pinnedId = help.pinnedReplyId;
    withVotes.sort((a, b) => {
      const aPinned = pinnedId != null && a.id === pinnedId;
      const bPinned = pinnedId != null && b.id === pinnedId;
      if (aPinned !== bPinned) return aPinned ? -1 : 1;

      const netA = a.upvotes - a.downvotes;
      const netB = b.upvotes - b.downvotes;
      if (netA !== netB) return netB - netA;

      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return {
      discussion: { ...help, upvotes: helpVotes.upvotes },
      replies: withVotes,
    };
  }
}
