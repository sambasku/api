// PRD relasi-lemma (docs/backlogs/PRD-relasi-lemma-sambasku.md)
// Kelompok lema bermakna sama/berdekatan. Entitas domain murni TS.
export type WordGroupStatus = 'pending_review' | 'published' | 'rejected';

export interface WordGroupMemberRecord {
  /** id baris keanggotaan (bukan word id) - dipakai DELETE member. */
  id: string;
  wordId: string;
  lemma: string;
  notes: string | null;
  status: WordGroupStatus;
  createdAt: Date;
}

export interface WordGroupRecord {
  id: string;
  name: string;
  description: string | null;
  status: WordGroupStatus;
  isVerified: boolean;
  createdBy: string | null;
  members: WordGroupMemberRecord[];
  createdAt: Date;
  updatedAt: Date | null;
}
