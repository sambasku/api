import type {
  BalehoActionType,
  BalehoCreativeStatus,
  BalehoEntityType,
  BalehoMediaType,
  BalehoPlacementStatus,
} from '@/shared/database/drizzle/schema/baleho.schema';

export type BalehoFrame = {
  id: string;
  sortOrder: number;
  mediaType: BalehoMediaType;
  mediaUrl: string | null;
  title: string | null;
  ctaLabel: string | null;
  actionType: BalehoActionType;
  actionPayload: string;
};

export type BalehoPlacementView = {
  id: string;
  slide: number;
  col: number;
  row: number;
  w: number;
  h: number;
  status: BalehoPlacementStatus;
  advertiserUserId: string;
  isOwnerPending: boolean;
  frames: BalehoFrame[];
  entityType: BalehoEntityType | null;
  entityId: string | null;
};

export type BalehoBoard = {
  slide: number;
  cols: number;
  rows: number;
  placements: BalehoPlacementView[];
};

export type CreateBalehoPlacementInput = {
  slide: number;
  col: number;
  row: number;
  w: number;
  h: number;
  referralUsername?: string | null;
  entityType?: BalehoEntityType | null;
  entityId?: string | null;
  days?: number;
  frames: Array<{
    mediaType: BalehoMediaType;
    mediaUrl?: string | null;
    title?: string | null;
    ctaLabel?: string | null;
    actionType: BalehoActionType;
    actionPayload: string;
  }>;
  /** Reaktivasi creative yang sudah approved. */
  creativeId?: string | null;
};

export type BalehoCreativeMeta = {
  id: string;
  ownerUserId: string;
  fingerprint: string;
  moderationStatus: BalehoCreativeStatus;
};
