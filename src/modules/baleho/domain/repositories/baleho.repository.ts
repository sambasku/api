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
  /** Jumlah slide/frame creative (untuk quote × slide). */
  countFrames(creativeId: string): Promise<number>;
  /** Creative approved milik user (untuk reaktivasi). */
  listApprovedCreatives(ownerUserId: string): Promise<
    Array<{
      id: string;
      fingerprint: string;
      title: string | null;
      mediaUrl: string | null;
      frameCount: number;
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
    days: number;
    pricePerCellPerDay: number;
    quotedAmount: number;
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
      paymentProofUrl: string | null;
      quotedAmount: number | null;
      pricePerCellPerDay: number | null;
      days: number | null;
      createdAt: Date;
      impressions: number;
      taps: number;
    }>
  >;
  listMine(
    advertiserUserId: string,
    limit: number,
  ): Promise<
    Array<{
      id: string;
      slide: number;
      col: number;
      row: number;
      w: number;
      h: number;
      status: BalehoPlacementStatus;
      title: string | null;
      mediaUrl: string | null;
      createdAt: Date;
      endsAt: Date | null;
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
  /** URL + file id bukti bayar (internal) - null bila belum ada. */
  getPaymentProof(placementId: string): Promise<{
    paymentProofUrl: string;
    paymentProofFileId: string;
  } | null>;
  updatePlacementStatus(args: {
    placementId: string;
    status: BalehoPlacementStatus;
    rejectReason?: string | null;
    awaitingPaymentAt?: Date | null;
    paidAt?: Date | null;
    startsAt?: Date | null;
    endsAt?: Date | null;
    paymentProofUrl?: string | null;
    paymentProofFileId?: string | null;
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
