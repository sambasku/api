import type {
  BalehoBoard,
  BalehoCreativeMeta,
  CreateBalehoPlacementInput,
} from '../baleho';
import type { BalehoPlacementStatus } from '@/shared/database/drizzle/schema/baleho.schema';

export type BalehoRepository = {
  getBoard(slide: number, viewerUserId: string | null): Promise<BalehoBoard>;
  countActiveForUser(userId: string): Promise<number>;
  findUserIdByUsername(username: string): Promise<{
    id: string;
    username: string;
    isActive: boolean;
  } | null>;
  getCreativeForOwner(
    creativeId: string,
    ownerUserId: string,
  ): Promise<BalehoCreativeMeta | null>;
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
      referralUsername: string | null;
      createdAt: Date;
    }>
  >;
  updatePlacementStatus(args: {
    placementId: string;
    status: BalehoPlacementStatus;
    rejectReason?: string | null;
    awaitingPaymentAt?: Date | null;
    paidAt?: Date | null;
    startsAt?: Date | null;
    endsAt?: Date | null;
    clearOccupancy?: boolean;
  }): Promise<boolean>;
  recordEvent(args: {
    placementId: string;
    frameId: string | null;
    eventType: string;
  }): Promise<void>;
};
