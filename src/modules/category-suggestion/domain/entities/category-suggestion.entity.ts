// Entitas usulan kategori baru (api#50) - murni domain, tanpa Drizzle/HTTP.
// Semua usulan lewat moderasi reviewer; approve = masuk master `categories`.

export type CategorySuggestionStatus = 'pending' | 'approved' | 'rejected';

export interface CategorySuggestion {
  id: string;
  name: string;
  reason: string | null;
  status: CategorySuggestionStatus;
  /** null = anonim. */
  proposedBy: string | null;
  /** Nama tampilan pengusul anonim (nullable - boleh kosong). */
  contributorName: string | null;
  /** Usulan lahir dari form usul kata (opsional). */
  wordSuggestionId: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  rejectReason: string | null;
  createdAt: Date;
}
