import type { HotTopicsResult } from './hot-topic.entity';

export interface HotTopicsRepository {
  /** Satu panggilan: tiga tab, masing-masing ≤ limit, tanpa duplikat. */
  listAllTabs(limit: number): Promise<HotTopicsResult>;
}
