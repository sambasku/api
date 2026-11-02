import type {
  PantunRepository,
  PantunSearchHit,
} from '../../domain/repositories/pantun.repository';

export class SearchPantunsUseCase {
  constructor(private readonly repo: PantunRepository) {}
  async execute(q: string, limit: number): Promise<PantunSearchHit[]> {
    return this.repo.searchPublished(q, limit);
  }
}
