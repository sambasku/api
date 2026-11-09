import { NotFoundError } from '@/shared/errors/app-error';
import type { JinyeTranslation } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

export class ListJinyeTranslationsUseCase {
  constructor(private readonly repo: JinyeRepository) {}

  async execute(jinyeId: string): Promise<JinyeTranslation[]> {
    const jinye = await this.repo.findById(jinyeId);
    if (!jinye || jinye.status !== 'published') {
      throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
    }
    return this.repo.listTranslationsByJinyeId(jinyeId);
  }
}
