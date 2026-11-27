export type MergeWordEntriesOptions = {
  requireSameLemma?: boolean;
  variantizeSourceLemmas?: boolean;
  foldKeepLemma?: boolean;
};

export const LEMMA_MERGE_TX_OPTIONS: MergeWordEntriesOptions = {
  requireSameLemma: false,
  variantizeSourceLemmas: true,
  foldKeepLemma: false,
};