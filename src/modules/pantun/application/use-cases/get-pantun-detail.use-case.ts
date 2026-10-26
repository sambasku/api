import type { VoteRepository } from '@/modules/vote/domain/repositories/vote.repository';
import { NotFoundError } from '@/shared/errors/app-error';
import type { Pantun, PantunReply } from '../../domain/entities/pantun.entity';
import type { PantunRepository } from '../../domain/repositories/pantun.repository';

export interface PantunReplyWithVotes extends PantunReply {
  upvotes: number;
  downvotes: number;
}

export interface PantunWithVotes extends Pantun {
  upvotes: number;
  downvotes: number;
}

export interface GetPantunDetailResult {
  pantun: PantunWithVotes;
  replies: PantunReplyWithVotes[];
}

/**
 * Detail publik: pembuka + balasan. Vote counts ditempel via countMany
 * batch (1 query tambahan, bukan N+1 per balasan).
 */
export class GetPantunDetailUseCase {
  constructor(
    private readonly repo: PantunRepository,
    private readonly voteRepo: VoteRepository,
  ) {}

  async execute(id: string): Promise<GetPantunDetailResult> {
    const pantun = await this.repo.findById(id);
    if (!pantun) {
      throw new NotFoundError('PANTUN_NOT_FOUND', 'Pantun tidak ditemukan');
    }

    const replies = await this.repo.listReplies(id);

    const counts = await this.voteRepo.countMany([
      { entityType: 'pantun', entityId: pantun.id },
      ...replies.map((r) => ({ entityType: 'pantun_reply' as const, entityId: r.id })),
    ]);

    const pantunVotes = counts.get(`pantun:${pantun.id}`) ?? { upvotes: 0, downvotes: 0 };

    return {
      pantun: { ...pantun, upvotes: pantunVotes.upvotes, downvotes: pantunVotes.downvotes },
      replies: replies.map((r) => {
        const v = counts.get(`pantun_reply:${r.id}`) ?? { upvotes: 0, downvotes: 0 };
        return { ...r, upvotes: v.upvotes, downvotes: v.downvotes };
      }),
    };
  }
}
