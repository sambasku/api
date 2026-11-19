import type { HotTopicsResult } from '../domain/hot-topic.entity';
import type { HotTopicsRepository } from '../domain/hot-topics.repository';

export interface ListHotTopicsQuery {
  limit?: number;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 10;

/**
 * G4: kartu Hot Home - tiga tab dalam satu response (hemat round-trip).
 * Jendela utama 24 jam; backfill 7 hari jika kurang dari limit.
 */
export class ListHotTopicsUseCase {
  constructor(private readonly repo: HotTopicsRepository) {}

  async execute(query: ListHotTopicsQuery = {}): Promise<HotTopicsResult> {
    const limit = Math.min(
      Math.max(1, query.limit ?? DEFAULT_LIMIT),
      MAX_LIMIT,
    );
    return this.repo.listAllTabs(limit);
  }
}
