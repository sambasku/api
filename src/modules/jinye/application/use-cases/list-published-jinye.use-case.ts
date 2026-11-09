import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type { Jinye } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

export class ListPublishedJinyeUseCase {
  constructor(private readonly repo: JinyeRepository) {}

  execute(input: {
    limit: number;
    cursor?: string;
    userId?: string;
  }): Promise<CursorPage<Jinye>> {
    return this.repo.list({
      limit: input.limit,
      cursor: input.cursor,
      userId: input.userId,
      status: 'published',
    });
  }
}
