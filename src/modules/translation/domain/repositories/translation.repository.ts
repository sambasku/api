import type { Translation, TranslationStatus } from '../entities/translation.entity';

export type CreateTranslationInput = {
  reff: string;
  reffId: string;
  body: string;
  translatorId: string;
};

export type ListTranslationsFilter = {
  reff: string;
  reffId: string;
  status?: TranslationStatus;
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
  updateStatus(
    id: string,
    status: TranslationStatus,
    reviewedBy: string,
  ): Promise<Translation>;
  /** Reject semua pending untuk pasangan reff+reffId (archive/delete sumber). */
  rejectPending(reff: string, reffId: string): Promise<void>;
}
