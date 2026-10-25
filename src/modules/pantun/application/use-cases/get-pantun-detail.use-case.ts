import { NotFoundError } from '@/shared/errors/app-error';
import type { Pantun, PantunReply } from '../../domain/entities/pantun.entity';
import type { PantunRepository } from '../../domain/repositories/pantun.repository';

export class GetPantunDetailUseCase {
  constructor(private readonly repo: PantunRepository) {}
  async execute(id: string): Promise<{ pantun: Pantun; replies: PantunReply[] }> {
    const pantun = await this.repo.findById(id);
    if (!pantun) {
      throw new NotFoundError('PANTUN_NOT_FOUND', 'Pantun tidak ditemukan');
    }
    const replies = await this.repo.listReplies(id);
    return { pantun, replies };
  }
}
