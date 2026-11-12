import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import { NotFoundError } from '@/shared/errors/app-error';
import type { JinyeStatus } from '@/shared/database/drizzle/schema/jinye.schema';
import type { Jinye } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

/** List admin: semua status (default), filter username/status opsional. */
export class ListAdminJinyeUseCase {
  constructor(
    private readonly repo: JinyeRepository,
    private readonly userRepo: Pick<UserRepository, 'findByUsername'>,
  ) {}

  async execute(input: {
    limit: number;
    cursor?: string;
    status?: JinyeStatus;
    username?: string;
  }): Promise<CursorPage<Jinye>> {
    let userId: string | undefined;
    if (input.username?.trim()) {
      const user = await this.userRepo.findByUsername(input.username.trim());
      if (!user || user.deletedAt) {
        throw new NotFoundError('USER_NOT_FOUND', 'Pengguna tidak ditemukan');
      }
      userId = user.id;
    }

    return this.repo.list({
      limit: input.limit,
      cursor: input.cursor,
      userId,
      status: input.status ?? 'all',
    });
  }
}
