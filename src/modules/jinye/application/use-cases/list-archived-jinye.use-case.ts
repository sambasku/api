import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type { Jinye } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

export class ListArchivedJinyeUseCase {
  constructor(private readonly repo: JinyeRepository) {}

  async execute(input: {
    userId: string;
    limit: number;
    cursor?: string;
  }): Promise<CursorPage<Jinye>> {
    return this.repo.list({
      limit: input.limit,
      cursor: input.cursor,
      userId: input.userId,
      status: 'archived',
    });
  }
}
