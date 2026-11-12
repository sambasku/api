export type TranslationStatus = 'pending' | 'accepted' | 'rejected';

export type Translation = {
  id: string;
  reff: string;
  reffId: string;
  /** Snapshot teks sumber saat usulan. */
  sourceBody: string;
  body: string;
  status: TranslationStatus;
  translatorId: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
};
