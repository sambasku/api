import { NotFoundError } from '@/shared/errors/app-error';
import type { KaryaLemmaLink } from '../../domain/karya';
import type { KaryaRepositoryImpl } from '../../infrastructure/karya.repository.impl';

export class ListKaryaExcerptLemmaLinksUseCase {
  constructor(private readonly repo: KaryaRepositoryImpl) {}

  async execute(excerptId: string): Promise<KaryaLemmaLink[]> {
    const ctx = await this.repo.findExcerptLemmaContext(excerptId);
    if (!ctx || ctx.deletedAt || ctx.publishStatus !== 'published') {
      throw new NotFoundError(
        'KARYA_EXCERPT_NOT_FOUND',
        'Cuplikan tidak ditemukan',
      );
    }
    return this.repo.listLemmaLinksForExcerpt(excerptId, true);
  }
}