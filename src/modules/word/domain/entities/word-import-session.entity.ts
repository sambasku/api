export type WordImportSessionStatus = 'running' | 'completed' | 'cancelled' | 'failed';

export type WordImportSupportType = 'web' | 'book' | 'article' | 'other';

export type WordImportSessionItem = {
  lemma: string;
  outcome: 'created' | 'meanings_added' | 'skipped' | 'invalid';
  meanings_added: number;
  message?: string;
  /** Id kata baru (outcome created) - untuk audit/rollback. */
  word_id?: string;
};

export type WordImportSession = {
  id: string;
  triggeredBy: string;
  triggeredByUsername: string | null;
  triggeredByDisplayName: string | null;
  attributedTo: string;
  attributedToUsername: string | null;
  attributedToDisplayName: string | null;
  sourceLabel: string | null;
  supportName: string | null;
  supportType: WordImportSupportType | null;
  supportAddress: string | null;
  supportTitle: string | null;
  supportDesc: string | null;
  claimedBy: string | null;
  claimedByUsername: string | null;
  claimedByDisplayName: string | null;
  claimedAt: Date | null;
  status: WordImportSessionStatus;
  total: number;
  createdCount: number;
  duplicatesCount: number;
  meaningsAddedCount: number;
  invalidCount: number;
  items: WordImportSessionItem[];
  createdAt: Date;
  finishedAt: Date | null;
  rolledBackAt: Date | null;
  rolledBackBy: string | null;
};

export type NewWordImportSession = {
  id: string;
  triggeredBy: string;
  attributedTo: string;
  sourceLabel?: string | null;
  supportName?: string | null;
  supportType?: WordImportSupportType | null;
  supportAddress?: string | null;
  supportTitle?: string | null;
  supportDesc?: string | null;
  status: WordImportSessionStatus;
  total: number;
  createdCount: number;
  duplicatesCount: number;
  meaningsAddedCount: number;
  invalidCount: number;
  items: WordImportSessionItem[];
  finishedAt?: Date | null;
};

export type ClaimWordImportSessionInput = {
  sessionId: string;
  fromUserId: string;
  toUserId: string;
  claimedBy: string;
  /** Lemma kata baru (outcome created) - update words (+ anak bila created_by sama). */
  createdLemmas: string[];
  /** Lemma makna ditambah - update meanings/examples dengan created_by lama. */
  meaningLemmas: string[];
};
