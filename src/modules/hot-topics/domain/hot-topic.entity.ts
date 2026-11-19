export type HotTopicTab = 'searched' | 'proposed' | 'near_threshold';

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

export interface HotNearThresholdItem {
  kind: 'meaning_vote';
  meaningId: string;
  wordId: string;
  lemma: string;
  definitionPreview: string | null;
  net: number;
  upvotes: number;
  downvotes: number;
  inWindow: boolean;
}

export interface HotTopicsResult {
  searched: { items: HotSearchedItem[]; meta: HotTopicTabMeta };
  proposed: { items: HotProposedItem[]; meta: HotTopicTabMeta };
  nearThreshold: { items: HotNearThresholdItem[]; meta: HotTopicTabMeta };
}
