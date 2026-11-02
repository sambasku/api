import type {
  CulinaryContribution,
  CulinaryContributionPayload,
  CulinaryContributionStatus,
  CulinaryContributionWithTarget,
} from './culinary-contribution.entity';

export interface CreateCulinaryContributionInput {
  kind: CulinaryContribution['kind'];
  userId: string;
  cuisineId?: string | null;
  placeId?: string | null;
  linkId?: string | null;
  lockedFields: string;
  payload: CulinaryContributionPayload;
  baseUpdatedAt?: Date | null;
}

export interface ListCulinaryContributionsInput {
  status?: CulinaryContributionStatus;
  kind?: CulinaryContribution['kind'];
}

export interface CulinaryContributionRepository {
  create(
    input: CreateCulinaryContributionInput,
  ): Promise<CulinaryContribution>;
  findById(id: string): Promise<CulinaryContribution | null>;
  listByUser(userId: string): Promise<CulinaryContributionWithTarget[]>;
  list(
    input: ListCulinaryContributionsInput,
  ): Promise<CulinaryContributionWithTarget[]>;
  countPending(userId: string): Promise<number>;
  /** Field-lock: field terkunci pengajuan pending lain untuk kuliner. */
  pendingLockedFieldsForCuisine(cuisineId: string): Promise<string[]>;
  /** Field-lock: field terkunci pengajuan pending lain untuk tempat. */
  pendingLockedFieldsForPlace(placeId: string): Promise<string[]>;
  setStatus(
    id: string,
    status: CulinaryContributionStatus,
    extra?: {
      revisionNote?: string | null;
      rejectReasonCode?: string | null;
      rejectReasonText?: string | null;
      resultCuisineId?: string | null;
      resultPlaceId?: string | null;
    },
  ): Promise<void>;
  replacePayload(
    id: string,
    payload: CulinaryContributionPayload,
    lockedFields: string,
    baseUpdatedAt?: Date | null,
  ): Promise<void>;
  remove(id: string): Promise<void>;
}
