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
  }): Promise<CursorPage<Jinye>> {
    let userId = input.userId;
    if (!userId && input.username) {
      const user = await this.userRepo?.findByUsername(input.username.trim());
      if (!user || user.deletedAt) {
        throw new NotFoundError('USER_NOT_FOUND', 'Pengguna tidak ditemukan');
      }
      userId = user.id;
    }
    return this.repo.list({
      limit: input.limit,
      cursor: input.cursor,
      userId,
      status: 'published',
    });
  }
}
