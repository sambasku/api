export type HotTopicTab = 'searched' | 'proposed' | 'viewed';

export interface HotTopicTabMeta {
  inWindow: number;
  backfilled: number;
  backfillUsed: boolean;
}

export interface HotSearchedItem {
  kind: 'search_miss';
  id: string;
  term: string;
  direction: 'lemma' | 'translation';
  hitCount: number;
  lastSearchedAt: Date;
  inWindow: boolean;
}

export interface HotProposedItem {
  kind: 'contribution';
  id: string;
  wordId: string;
  lemma: string;
  createdAt: Date;
  inWindow: boolean;
}

/** Top lemma by unique viewers (word_views). Window = hari WIB ini. */
export interface HotViewedItem {
  kind: 'word_view';
  wordId: string;
  lemma: string;
  viewCount: number;
  lastViewedDay: string;
  inWindow: boolean;
}

export interface HotTopicsResult {
  searched: { items: HotSearchedItem[]; meta: HotTopicTabMeta };
  proposed: { items: HotProposedItem[]; meta: HotTopicTabMeta };
  viewed: { items: HotViewedItem[]; meta: HotTopicTabMeta };
}
