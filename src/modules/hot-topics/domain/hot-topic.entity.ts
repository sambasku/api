export type HotTopicTab =
  | 'searched'
  | 'proposed'
  | 'viewed'
  | 'check'
  | 'verified'
  | 'commented';

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

/** Top lemma by unique viewers (word_views). Window ≈ hari ini + kemarin WIB. */
export interface HotViewedItem {
  kind: 'word_view';
  wordId: string;
  lemma: string;
  viewCount: number;
  lastViewedDay: string;
  inWindow: boolean;
}

/** Makna published dengan downvote aktif (votes.value = -1). Chip Cek. */
export interface HotCheckItem {
  kind: 'meaning_downvote';
  meaningId: string;
  wordId: string;
  lemma: string;
  definitionPreview: string | null;
  downvotes: number;
  lastDownvotedAt: Date;
  inWindow: boolean;
}

/** Lemma published yang baru diverifikasi (words.verified_at DESC). Chip Verif. */
export interface HotVerifiedItem {
  kind: 'word_verified';
  wordId: string;
  lemma: string;
  verifiedAt: Date;
  inWindow: boolean;
}

/** Lemma dengan komentar published terbaru (agregat 7 hari). Chip Komen. */
export interface HotCommentedItem {
  kind: 'word_commented';
  wordId: string;
  lemma: string;
  commentCount: number;
  lastCommentedAt: Date;
  inWindow: boolean;
}

export interface HotTopicsResult {
  searched: { items: HotSearchedItem[]; meta: HotTopicTabMeta };
  proposed: { items: HotProposedItem[]; meta: HotTopicTabMeta };
  viewed: { items: HotViewedItem[]; meta: HotTopicTabMeta };
  check: { items: HotCheckItem[]; meta: HotTopicTabMeta };
  verified: { items: HotVerifiedItem[]; meta: HotTopicTabMeta };
  commented: { items: HotCommentedItem[]; meta: HotTopicTabMeta };
}
