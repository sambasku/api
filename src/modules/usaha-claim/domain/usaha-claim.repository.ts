import type { UsahaClaimStatus } from '@/shared/database/drizzle/schema/usaha-claims.schema';
import type {
  UsahaClaim,
  UsahaClaimWithUsaha,
} from './usaha-claim.entity';

export interface UsahaClaimRepository {
  create(input: {
    usahaId: string;
    userId: string;
    contactEvidence: string;
    note?: string | null;
  }): Promise<UsahaClaim>;
  findById(id: string): Promise<UsahaClaim | null>;
  findPendingByUser(usahaId: string, userId: string): Promise<UsahaClaim | null>;
  listByUser(userId: string): Promise<UsahaClaimWithUsaha[]>;
  listByStatus(status: UsahaClaimStatus): Promise<UsahaClaimWithUsaha[]>;
  listPendingForUsaha(usahaId: string): Promise<UsahaClaimWithUsaha[]>;
  countPendingByUser(userId: string): Promise<number>;
  setStatus(
    id: string,
    status: UsahaClaimStatus,
    extra?: {
      rejectReasonCode?: string | null;
      rejectReasonText?: string | null;
      reviewedBy?: string | null;
    },
  ): Promise<void>;
  /**
   * Setujui klaim secara atomik: manager usaha diisi, klaim ini approved,
   * klaim pending lain untuk usaha sama ditolak `claim_conflict`
   * (PRD 8: satu pengelola aktif; konflik diselesaikan admin).
   */
  approveExclusive(claimId: string, reviewedBy: string): Promise<void>;
}
