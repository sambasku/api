import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import { NotFoundError } from '@/shared/errors/app-error';
import type { Jinye } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

export class ListPublishedJinyeUseCase {
  constructor(
    private readonly repo: JinyeRepository,
    private readonly userRepo?: Pick<UserRepository, 'findByUsername'>,
  ) {}

  async execute(input: {
    limit: number;
    cursor?: string;
    userId?: string;
    username?: string;
    wordId?: string;
  }): Promise<CursorPage<Jinye> & { pinnedId: string | null }> {
    let userId = input.userId;
    if (!userId && input.username) {
      const user = await this.userRepo?.findByUsername(input.username.trim());
      if (!user || user.deletedAt) {
        throw new NotFoundError('USER_NOT_FOUND', 'Pengguna tidak ditemukan');
      }
      userId = user.id;
    }

    // Filter lemma: tanpa pin profil (bukan timeline user).
    if (input.wordId) {
      const page = await this.repo.list({
        limit: input.limit,
        cursor: input.cursor,
        wordId: input.wordId,
        status: 'published',
      });
      return { ...page, pinnedId: null };
    }

    let pinnedId: string | null = null;
    let pinned: Jinye | null = null;

    if (userId) {
      pinnedId = await this.repo.getPinnedJinyeId(userId);
      if (pinnedId) {
        const row = await this.repo.findById(pinnedId);
        if (row && row.status === 'published' && row.userId === userId) {
          pinned = row;
        } else {
          await this.repo.setPinnedJinyeId(userId, null);
          pinnedId = null;
        }
      }
    }

    const firstPage = !input.cursor;
    const pageLimit =
      pinned && firstPage ? Math.max(input.limit - 1, 0) : input.limit;

    const page =
      pageLimit === 0 && pinned && firstPage
        ? {
            items: [] as Jinye[],
            nextCursor: null as string | null,
            hasMore: false,
          }
        : await this.repo.list({
            limit: Math.max(pageLimit, 1),
            cursor: input.cursor,
            userId,
            status: 'published',
            excludeId: pinned?.id,
          });

    if (pinned && firstPage) {
      return {
        items: [pinned, ...page.items].slice(0, input.limit),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore || page.items.length + 1 > input.limit,
        pinnedId: pinned.id,
      };
    }

    return { ...page, pinnedId };
  }
}
