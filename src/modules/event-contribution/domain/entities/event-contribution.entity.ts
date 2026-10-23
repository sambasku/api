import type { EventSourceType } from "@/modules/event/domain/entities/event.entity";

export type EventContributionStatus =
  | "pending"
  | "needs_revision"
  | "approved"
  | "rejected";

/**
 * Data acara usulan. Disimpan apa adanya di `payload_json` supaya data
 * asli pengusul tetap utuh setelah disetujui (dan supaya admin bisa
 * membandingkan dengan versi revisi).
 */
export interface EventContributionPayload {
  name: string;
  description: string;
  categoryId: string;
  startsAt: string;
  endsAt: string;
  locationText: string;
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  posterUrls: string[];
  organizer: string | null;
  /** Link original konten (FB/IG/website) - disimpan BERSIH tanpa UTM. */
  sourceUrl: string | null;
  sourceType: EventSourceType | null;
  sourceAttribution: string | null;
  regionId: string | null;
  villageId: string | null;
  placeIds: string[];
}

export interface EventContribution {
  id: string;
  userId: string;
  /** Event resmi hasil approval. Null = usulan murni. */
  eventId: string | null;
  payload: EventContributionPayload;
  status: EventContributionStatus;
  revisionNote: string | null;
  rejectReasonCode: string | null;
  rejectReasonText: string | null;
  createdAt: Date;
  updatedAt: Date | null;
  reviewedAt: Date | null;
}
