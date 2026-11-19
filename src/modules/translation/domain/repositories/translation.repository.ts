import type { Translation, TranslationStatus } from '../entities/translation.entity';

export type CreateTranslationInput = {
  reff: string;
  reffId: string;
  sourceBody: string;
  body: string;
  translatorId: string;
  /** Default pending. Auto-promote contoh verifikator → accepted. */
  status?: TranslationStatus;
  reviewedBy?: string | null;
};

export type UpsertAcceptedTranslationInput = {
  reff: string;
  reffId: string;
  sourceBody: string;
  body: string;
  translatorId: string;
  reviewerId: string;
};

export type ListTranslationsFilter = {
  reff: string;
  /** Kosong = semua target untuk `reff` (antrian review). */
  reffId?: string;
  status?: TranslationStatus;
  /** Cap antrian; default repo. */
  limit?: number;
};

export interface TranslationRepository {
  create(input: CreateTranslationInput): Promise<Translation>;
  findById(id: string): Promise<Translation | null>;
  list(filter: ListTranslationsFilter): Promise<Translation[]>;
  findPendingByTranslator(
    reff: string,
    reffId: string,
    translatorId: string,
  ): Promise<Translation | null>;
  findAccepted(reff: string, reffId: string): Promise<Translation | null>;
  /**
   * Auto-promote: supersede accepted lama (reject) lalu insert accepted baru.
   * Idempoten untuk body yang sama (kembalikan accepted yang sudah cocok).
   */
  upsertAccepted(input: UpsertAcceptedTranslationInput): Promise<Translation>;
  updateStatus(
    id: string,
    status: TranslationStatus,
    reviewedBy: string,
  ): Promise<Translation>;
  /** Reject semua pending untuk pasangan reff+reffId (archive/delete sumber). */
  rejectPending(reff: string, reffId: string): Promise<void>;
}
