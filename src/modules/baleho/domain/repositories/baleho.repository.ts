import type {
  BalehoBoard,
  BalehoCreativeMeta,
  CreateBalehoPlacementInput,
} from '../baleho';
import type { BalehoPlacementStatus } from '@/shared/database/drizzle/schema/baleho.schema';

export type BalehoRepository = {
  getBoard(slide: number, viewerUserId: string | null): Promise<BalehoBoard>;
  countActiveForUser(userId: string): Promise<number>;
  /** True jika pengiklan sudah punya pesanan locking dengan fingerprint sama. */
  hasActiveFingerprint(
    advertiserUserId: string,
    fingerprint: string,
  ): Promise<boolean>;
  findUserIdByUsername(username: string): Promise<{
    id: string;
    username: string;
    isActive: boolean;
  } | null>;
  getCreativeForOwner(
    creativeId: string,
    ownerUserId: string,
  ): Promise<BalehoCreativeMeta | null>;
  /** Creative approved milik user (untuk reaktivasi). */
  listApprovedCreatives(ownerUserId: string): Promise<
    Array<{
      id: string;
      fingerprint: string;
      title: string | null;
      mediaUrl: string | null;
      lastReferralUsername: string | null;
      lastReferrerUserId: string | null;
    }>
  >;
  /** Referral snapshot dari placement terakhir creative ini. */
  getLatestReferralForCreative(creativeId: string): Promise<{
    referrerUserId: string | null;
    referralUsername: string | null;
  } | null>;
  createPlacement(args: {
    advertiserUserId: string;
    input: CreateBalehoPlacementInput;
    fingerprint: string;
    referrerUserId: string | null;
    referralUsername: string | null;
    status: BalehoPlacementStatus;
    startsAt: Date | null;
    endsAt: Date | null;
    awaitingPaymentAt: Date | null;
  }): Promise<{ placementId: string; creativeId: string }>;
  listAdmin(limit: number): Promise<
    Array<{
      id: string;
      slide: number;
      col: number;
      row: number;
      w: number;
      h: number;
      status: BalehoPlacementStatus;
      advertiserUserId: string;
      advertiserUsername: string | null;
      referralUsername: string | null;
      createdAt: Date;
      impressions: number;
      taps: number;
    }>
  >;
  getPlacementNotify(placementId: string): Promise<{
    id: string;
    col: number;
    row: number;
    w: number;
    h: number;
    status: BalehoPlacementStatus;
    advertiserUserId: string;
    referrerUserId: string | null;
  } | null>;
  updatePlacementStatus(args: {
    placementId: string;
    status: BalehoPlacementStatus;
    rejectReason?: string | null;
    awaitingPaymentAt?: Date | null;
    paidAt?: Date | null;
    startsAt?: Date | null;
    endsAt?: Date | null;
    clearOccupancy?: boolean;
    /** Saat approve: set creative → approved. */
    approveCreative?: boolean;
  }): Promise<boolean>;
  /**
   * Timeout bayar (awaiting_payment > 48 jam) → cancelled + lepas slot.
   * Expire live (ends_at lewat) → expired + lepas slot.
   */
  releaseDue(now: Date): Promise<{ cancelled: number; expired: number }>;
  createCommissionUnclaimed(args: {
    placementId: string;
    referrerUserId: string;
  }): Promise<void>;
  recordEvent(args: {
    placementId: string;
    frameId: string | null;
    eventType: string;
  }): Promise<void>;
};
