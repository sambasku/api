import type {
  UsahaContributionKind,
  UsahaContributionStatus,
} from '@/shared/database/drizzle/schema/usaha-contributions.schema';
import type {
  UsahaContribution,
  UsahaContributionPayload,
  UsahaContributionWithUsaha,
} from './usaha-contribution.entity';

export interface CreateUsahaContributionInput {
  kind: UsahaContributionKind;
  userId: string;
  usahaId?: string | null;
  itemId?: string | null;
  lockedFields: string;
  payload: UsahaContributionPayload;
  baseUpdatedAt?: Date | null;
  wantsClaim?: boolean;
}

export interface ListUsahaContributionsInput {
  status?: UsahaContributionStatus;
  kind?: UsahaContributionKind;
}

export interface UsahaContributionRepository {
  create(input: CreateUsahaContributionInput): Promise<UsahaContribution>;
  findById(id: string): Promise<UsahaContribution | null>;
  listByUser(userId: string): Promise<UsahaContributionWithUsaha[]>;
  list(input: ListUsahaContributionsInput): Promise<UsahaContributionWithUsaha[]>;
  countPending(userId: string): Promise<number>;
  /** Kanonik ter-sort: dasar pembanding overlap field-lock. */
  pendingLockedFields(usahaId: string): Promise<string[]>;
  /** Ringkasan jumlah pengajuan pending per usaha (Usaha Saya, 1 query IN). */
  pendingCountsByUsaha(usahaIds: string[]): Promise<Map<string, number>>;
  setStatus(
    id: string,
    status: UsahaContributionStatus,
    extra?: {
      revisionNote?: string | null;
      rejectReasonCode?: string | null;
      rejectReasonText?: string | null;
      resultUsahaId?: string | null;
    },
  ): Promise<void>;
  replacePayload(
    id: string,
    payload: UsahaContributionPayload,
    lockedFields: string,
    baseUpdatedAt?: Date | null,
  ): Promise<void>;
  remove(id: string): Promise<void>;
}
