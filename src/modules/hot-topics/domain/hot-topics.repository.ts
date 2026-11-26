import type { HotTopicsResult } from './hot-topic.entity';

export interface HotTopicsRepository {
  /** Satu panggilan: enam tab, masing-masing ≤ limit, tanpa duplikat. */
  listAllTabs(limit: number): Promise<HotTopicsResult>;
}
