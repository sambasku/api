import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type { Pantun, PantunListFilter } from '../../domain/entities/pantun.entity';
import type { PantunRepository } from '../../domain/repositories/pantun.repository';

export class ListPublishedPantunsUseCase {
  constructor(private readonly repo: PantunRepository) {}
  async execute(filter: PantunListFilter): Promise<CursorPage<Pantun>> {
    return this.repo.list({ ...filter, status: 'published' });
  }
}
