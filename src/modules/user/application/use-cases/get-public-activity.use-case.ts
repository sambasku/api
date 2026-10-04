import { NotFoundError } from '@/shared/errors/app-error';
import type { PublicActivityItem } from '../../domain/entities/public-profile.entity';
import type { PublicActivityQueryInput } from './public-activity.types';
import type { PublicUserRepository } from '../../domain/repositories/public-user.repository';

const ACTIVITY_LIMIT = 20;
/** Ambil lebih banyak per sumber lalu merge - cukup untuk 20 terbaru. */
const PER_SOURCE = 20;

export type { PublicActivityQueryInput };

export interface PublicActivityPageResult {
  items: PublicActivityItem[];
  /** Terisi hanya saat mode terfilter (query.kind diberikan). Null = halaman terakhir. */
  nextCursor?: string | null;
}

export class GetPublicActivityUseCase {
  constructor(private readonly publicUserRepo: PublicUserRepository) {}

  async execute(
    username: string,
    query?: PublicActivityQueryInput,
  ): Promise<PublicActivityPageResult> {
    const user = await this.publicUserRepo.findPublicByUsername(username);
    if (!user) {
      throw new NotFoundError('USER_NOT_FOUND', 'User tidak ditemukan');
    }

    // Mode filter satu kategori: repo sudah kembalikan halaman keyset.
    if (query?.kind) {
      const { limit, cursor } = query;
      const page = await this.listByKind(user.id, query.kind, {
        limit,
        cursor,
      });
      return { items: page.items, nextCursor: page.nextCursor };
    }

    // Mode merge: perilaku lama (top 20 campuran, tanpa cursor).
    const [contributions, comments, verifications, votes] = await Promise.all([
      this.publicUserRepo.listRecentApprovedContributions(user.id, { limit: PER_SOURCE }),
      this.publicUserRepo.listRecentPublishedComments(user.id, { limit: PER_SOURCE }),
      this.publicUserRepo.listRecentVerifications(user.id, { limit: PER_SOURCE }),
      this.publicUserRepo.listRecentVotes(user.id, { limit: PER_SOURCE }),
    ]);

    const items = [
      ...contributions.items,
      ...comments.items,
      ...verifications.items,
      ...votes.items,
    ]
      .sort((a, b) => {
        const t = b.occurredAt.getTime() - a.occurredAt.getTime();
        if (t !== 0) return t;
        return (b.lemma ?? '').localeCompare(a.lemma ?? '');
      })
      .slice(0, ACTIVITY_LIMIT);

    return { items };
  }

  private listByKind(
    userId: string,
    kind: 'contribution' | 'comment' | 'verification' | 'vote',
    params: { limit: number; cursor?: string },
  ) {
    switch (kind) {
      case 'contribution':
        return this.publicUserRepo.listRecentApprovedContributions(userId, params);
      case 'comment':
        return this.publicUserRepo.listRecentPublishedComments(userId, params);
      case 'verification':
        return this.publicUserRepo.listRecentVerifications(userId, params);
      case 'vote':
        return this.publicUserRepo.listRecentVotes(userId, params);
    }
  }
}
