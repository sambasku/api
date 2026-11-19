import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import { normalizeSearchMissTerm } from '@/modules/search-miss/domain/normalize-term';
import {
  passesSearchMissQualityGate,
  searchMissBlocklistTokens,
} from '@/modules/search-miss/domain/quality-gate';
import type {
  HotProposedItem,
  HotSearchedItem,
  HotTopicTabMeta,
  HotTopicsResult,
  HotViewedItem,
} from '../domain/hot-topic.entity';
import type { HotTopicsRepository } from '../domain/hot-topics.repository';

export interface ListHotTopicsQuery {
  limit?: number;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 10;

function tabMeta(inWindow: number, total: number): HotTopicTabMeta {
  const backfilled = Math.max(0, total - inWindow);
  return {
    inWindow,
    backfilled,
    backfillUsed: backfilled > 0,
  };
}

function takeSafe<T extends { inWindow: boolean }>(
  items: T[],
  limit: number,
  keep: (item: T) => boolean,
): { items: T[]; meta: HotTopicTabMeta } {
  const filtered = items.filter(keep).slice(0, limit);
  const inWindow = filtered.filter((i) => i.inWindow).length;
  return { items: filtered, meta: tabMeta(inWindow, filtered.length) };
}

/**
 * G4/G6: kartu Sorotan Home - tiga tab dalam satu response.
 * Setelah fetch: saring blocklist + quality (term/lemma) supaya
 * seksual / diskriminatif / kata diblokir tidak tampil di kartu.
 */
export class ListHotTopicsUseCase {
  constructor(
    private readonly repo: HotTopicsRepository,
    private readonly blocklist?: Pick<CommentBlocklistRepository, 'findActiveWordSet'>,
  ) {}

  async execute(query: ListHotTopicsQuery = {}): Promise<HotTopicsResult> {
    const limit = Math.min(
      Math.max(1, query.limit ?? DEFAULT_LIMIT),
      MAX_LIMIT,
    );
    const raw = await this.repo.listAllTabs(limit);

    const texts = [
      ...raw.searched.items.map((i) => i.term),
      ...raw.proposed.items.map((i) => i.lemma),
      ...raw.viewed.items.map((i) => i.lemma),
    ];
    const tokenSet = new Set<string>();
    for (const text of texts) {
      const normalized = normalizeSearchMissTerm(text);
      if (!normalized) continue;
      for (const t of searchMissBlocklistTokens(normalized)) {
        tokenSet.add(t);
      }
    }
    const blocked = this.blocklist
      ? await this.blocklist.findActiveWordSet([...tokenSet])
      : new Set<string>();

    const isBlockedText = (text: string): boolean => {
      const normalized = normalizeSearchMissTerm(text);
      if (!normalized) return true;
      if (!passesSearchMissQualityGate(normalized)) return true;
      const tokens = searchMissBlocklistTokens(normalized);
      return tokens.some((t) => blocked.has(t));
    };

    return {
      searched: takeSafe(raw.searched.items, limit, (i: HotSearchedItem) => !isBlockedText(i.term)),
      proposed: takeSafe(raw.proposed.items, limit, (i: HotProposedItem) => !isBlockedText(i.lemma)),
      viewed: takeSafe(raw.viewed.items, limit, (i: HotViewedItem) => !isBlockedText(i.lemma)),
    };
  }
}
