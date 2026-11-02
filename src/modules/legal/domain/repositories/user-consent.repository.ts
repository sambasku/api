import type { AppDatabase, AppTransaction } from '@/shared/database/drizzle/client';
import type { NewUserConsent, UserConsent } from '../entities/user-consent.entity';
import type { ConsentDocumentType } from '../entities/user-consent.entity';

export type DbExecutor = AppDatabase | AppTransaction;

export interface UserConsentRepository {
  insertMany(rows: NewUserConsent[], executor?: DbExecutor): Promise<UserConsent[]>;
  findLatestByUser(
    userId: string,
    documentType: ConsentDocumentType,
  ): Promise<UserConsent | null>;
  /**
   * Versi consent terbaru per document_type dalam SATU query.
   * Dipakai path read (compute requires_consent) - 2 pemanggilan
   * findLatestByUser = 2 subrequest, ini cuma 1.
   */
  findLatestByUserAll(
    userId: string,
  ): Promise<Partial<Record<ConsentDocumentType, UserConsent>>>;
  deleteByUserId(userId: string, executor?: DbExecutor): Promise<void>;
}
