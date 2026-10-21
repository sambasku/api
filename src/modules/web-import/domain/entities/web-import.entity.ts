export type WebImportStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'processing'
  | 'completed'
  | 'failed';

export type WebImportSupportType = 'web' | 'book' | 'article' | 'other';

export type WebImportDetailStatus = 'pending' | 'approved' | 'rejected' | 'skipped';

/** Hasil proses ke tabel words (diisi V2 saat runner jalan). */
export type WebImportDetailOutcome = 'created' | 'meanings_added' | 'skipped' | 'invalid';

export type WebImportDetail = {
  id: string;
  importId: string;
  rowNumber: number;
  kata: string;
  terjemahan: string | null;
  penjelasanArti: string | null;
  /** Kode kelas kata (kb/kk/ks/kt/kd) atau null = umum. */
  type: string | null;
  contoh: string | null;
  artiContoh: string | null;
  status: WebImportDetailStatus;
  adminNote: string | null;
  outcome: WebImportDetailOutcome | null;
  outcomeMessage: string | null;
  wordId: string | null;
  createdAt: Date;
};

export type NewWebImportDetail = Omit<WebImportDetail, 'id' | 'importId' | 'createdAt'>;

/** Header pengajuan web importer (petugas publik tanpa login). */
export type WebImport = {
  id: string;
  submittedBy: string;
  officerName: string;
  sourceLabel: string | null;
  supportName: string | null;
  supportType: WebImportSupportType | null;
  supportAddress: string | null;
  supportTitle: string | null;
  supportDesc: string | null;
  status: WebImportStatus;
  totalRows: number;
  reviewedBy: string | null;
  /** Nama tampilan admin reviewer (joined). */
  reviewedByName: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewWebImport = {
  id: string;
  submittedBy: string;
  officerName: string;
  sourceLabel: string | null;
  supportName: string | null;
  supportType: WebImportSupportType | null;
  supportAddress: string | null;
  supportTitle: string | null;
  supportDesc: string | null;
  details: NewWebImportDetail[];
};
