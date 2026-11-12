import { NotFoundError } from '@/shared/errors/app-error';
import type { JinyeLemmaLink } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

export class ListJinyeLemmaLinksUseCase {
  constructor(private readonly repo: JinyeRepository) {}

  async execute(jinyeId: string): Promise<JinyeLemmaLink[]> {
    const jinye = await this.repo.findById(jinyeId);
    if (!jinye) {
      throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
    }
    return this.repo.listLemmaLinksByJinyeId(jinyeId);
  }
}
