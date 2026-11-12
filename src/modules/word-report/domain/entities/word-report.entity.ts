import type {
  TakedownReasonCode,
  WordReportReasonCode,
} from '@/modules/word/domain/entities/word.entity';

export type WordReportStatus = 'open' | 'resolved';
export type WordReportResolution =
  | 'dismissed'
  | 'taken_down'
  | 'corrected'
  | 'flagged_image'
  | 'meaning_removed';

/** Filter list admin: entri kata / foto / makna (#253). */
export type WordReportTarget = 'entry' | 'image' | 'meaning';

export interface WordReport {
  id: string;
  wordId: string;
  imageId: string | null;
  meaningId: string | null;
  /** Cuplikan definisi bila meaning_id terisi. */
  meaningDefinition: string | null;
  wordLemma: string;
  wordStatus: string;
  userId: string;
  username: string | null;
  /** Label UI; fallback username bila display_name kosong. */
  displayName: string | null;
  reasonCode: WordReportReasonCode;
  note: string | null;
  status: WordReportStatus;
  resolution: WordReportResolution | null;
  resolutionNote: string | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface NewWordReport {
  wordId: string;
  imageId?: string | null;
  meaningId?: string | null;
  userId: string;
  reasonCode: WordReportReasonCode;
  note: string | null;
}

export interface WordReportListFilter {
  status?: WordReportStatus;
  target?: WordReportTarget;
  limit: number;
  cursor?: string;
}

/** Alasan yang boleh dipakai untuk takedown kata (bukan laporan foto). */
export type { TakedownReasonCode };
