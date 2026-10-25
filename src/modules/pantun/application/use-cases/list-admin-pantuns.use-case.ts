import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type { Pantun } from '../../domain/entities/pantun.entity';
import type { PantunRepository } from '../../domain/repositories/pantun.repository';

/** List admin: semua status, urut terbaru. */
export class ListAdminPantunsUseCase {
  constructor(private readonly repo: PantunRepository) {}
  async execute(filter: { limit: number; cursor?: string }): Promise<CursorPage<Pantun>> {
    return this.repo.list({ ...filter, status: 'all' });
  }
}
