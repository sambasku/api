import type { CulinaryClaimStatus } from '@/shared/database/drizzle/schema/culinary-claims.schema';
import type {
  CulinaryClaim,
  CulinaryClaimWithPlace,
} from './culinary-claim.entity';

export interface CulinaryClaimRepository {
  create(input: {
    placeId: string;
    userId: string;
    contactEvidence: string;
    note?: string | null;
  }): Promise<CulinaryClaim>;
  findById(id: string): Promise<CulinaryClaim | null>;
  findPendingByUser(placeId: string, userId: string): Promise<CulinaryClaim | null>;
  listByUser(userId: string): Promise<CulinaryClaimWithPlace[]>;
  listByStatus(status: CulinaryClaimStatus): Promise<CulinaryClaimWithPlace[]>;
  listPendingForPlace(placeId: string): Promise<CulinaryClaimWithPlace[]>;
  countPendingByUser(userId: string): Promise<number>;
  setStatus(
    id: string,
    status: CulinaryClaimStatus,
    extra?: {
      rejectReasonCode?: string | null;
      rejectReasonText?: string | null;
      reviewedBy?: string | null;
    },
  ): Promise<void>;
  /**
   * Setujui klaim secara atomik: manager place diisi, klaim ini approved,
   * klaim pending lain untuk place sama ditolak `claim_conflict`
   * (PRD 8: satu pengelola aktif; konflik diselesaikan admin).
   */
  approveExclusive(claimId: string, reviewedBy: string): Promise<void>;
}
