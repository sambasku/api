import type { VoteRepository } from '@/modules/vote/domain/repositories/vote.repository';
import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type {
  Pantun,
  PantunListFilter,
} from '../../domain/entities/pantun.entity';
import type { PantunRepository } from '../../domain/repositories/pantun.repository';
import type { PantunWithVotes } from './get-pantun-detail.use-case';

/**
 * Feed pantun tayang. Vote counts ditempel via countMany batch - satu
 * query tambahan per halaman, bukan per baris (AGENTS.md #26).
 */
export class ListPublishedPantunsUseCase {
  constructor(
    private readonly repo: PantunRepository,
    private readonly voteRepo: VoteRepository,
  ) {}

  async execute(filter: PantunListFilter): Promise<CursorPage<PantunWithVotes>> {
    const page = await this.repo.list({ ...filter, status: 'published' });
    if (page.items.length === 0) {
      return { ...page, items: [] };
    }

    const counts = await this.voteRepo.countMany(
      page.items.map((p) => ({ entityType: 'pantun' as const, entityId: p.id })),
    );

    return {
      ...page,
      items: page.items.map((p) => {
        const v = counts.get(`pantun:${p.id}`) ?? { upvotes: 0, downvotes: 0 };
        return { ...p, upvotes: v.upvotes, downvotes: v.downvotes };
      }),
    };
  }
}
