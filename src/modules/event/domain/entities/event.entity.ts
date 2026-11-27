import type { CommentAudio, CommentImage } from '@/modules/comment/domain/entities/comment.entity';
import type { EventCommentStatus } from '@/shared/database/drizzle/schema/event-comments.schema';

/** Id slug di tabel `event_categories`. */
export type EventCategory = string;

export type EventStatus = "draft" | "published" | "archived";

/**
 * Status pelaksanaan - DITURUNKAN read-time dari jadwal + pembatalan
 * (PRD 7.2: jangan menyimpan status turunan secara redundan).
 */
export type EventOccurrenceStatus =
  | "upcoming"
  | "ongoing"
  | "completed"
  | "cancelled";

export type EventSourceType =
  | "facebook"
  | "instagram"
  | "website"
  | "tiktok"
  | "youtube"
  | "whatsapp"
  | "other";

export interface Event {
  id: string;
  slug: string;
  name: string;
  description: string;
  categoryId: EventCategory;
  startsAt: Date | null;
  endsAt: Date | null;
  /** Lokasi aktual acara. Independen dari relasi wisata/desa (PRD 6.3). */
  locationText: string;
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  /** Poster acara (bisa lebih dari satu). [0] dipakai sebagai sampul. */
  posterUrls: string[];
  /** Penyelenggara opsional (PRD 6.2): teks, bukan entitas. */
  organizer: string | null;
  /** Link original konten (FB/IG/website). Disimpan BERSIH tanpa UTM. */
  sourceUrl: string | null;
  sourceType: EventSourceType | null;
  sourceAttribution: string | null;
  regionId: string | null;
  /** ULID desa di `regions`. Null = belum masuk desa. */
  villageId: string | null;
  status: EventStatus;
  cancelledAt: Date | null;
  publishedAt: Date | null;
  authorId: string | null;
/** Pengusul live; diisi di path detail. List boleh null. */
author: EventAuthorRef | null;
/** Id-nama tempat wisata terkait (dipaket dari JOIN). */
places: EventPlaceRef[];
/** Galeri foto acara (user-generated, pola place_images #187). Hanya
 * diisi di path detail (3 foto pratinjau); list kosong. */
images: EventImage[];
createdAt: Date;
updatedAt: Date | null;
}

export interface EventAuthorRef {
  id: string;
  username: string;
  displayName: string;
}

export interface EventPlaceRef {
  id: string;
  slug: string;
  name: string;
  category: string | null;
}

/** Kredit foto galeri acara (pola PlaceImageAttribution). */
export interface EventImageAttribution {
  name: string;
  provider?: string;
  authorId?: string | null;
}

/** Satu foto galeri acara (user-generated, pola place_images #187). */
export interface EventImage {
  id: string;
  url: string;
  attribution: EventImageAttribution | null;
}

/** Nama kategori + village/desa yang ikut dipaketkan untuk display. */
export interface EventCategoryRef {
  id: string;
  name: string;
}

export interface EventVillageRef {
  id: string;
  name: string;
  slug: string | null;
}

export interface EventListItem extends Event {
  category: EventCategoryRef | null;
  village: EventVillageRef | null;
}

export interface EventComment {
  id: string;
  eventId: string;
  parentId: string | null;
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  userRole: string | null;
  authorDeletedAt: Date | null;
  body: string;
  stickerId: string | null;
  audio: CommentAudio | null;
  image: CommentImage | null;
  status: EventCommentStatus;
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date | null;
  replies?: EventComment[];
}

/**
 * Status pelaksanaan dari jadwal + pembatalan. `now` bisa diinject agar
 * deterministik di test.
 */
export function occurrenceStatus(
  event: Pick<Event, "startsAt" | "endsAt" | "cancelledAt">,
  now: Date = new Date(),
): EventOccurrenceStatus {
  if (event.cancelledAt) return "cancelled";
  if (!event.startsAt) return "upcoming";
  const endsAt = event.endsAt ?? event.startsAt;
  if (now < event.startsAt) return "upcoming";
  if (now > endsAt) return "completed";
  return "ongoing";
}

/** Kunci tanggal kalender WIB (UTC+7, tanpa DST). `en-CA` = YYYY-MM-DD. */
function jakartaDateKey(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/**
 * Hari acara (WIB) sudah tiba. `startsAt` null = belum.
 * Pagi hari-H tetap true walau jam mulai masih nanti.
 */
export function eventDateReached(
  startsAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (!startsAt) return false;
  return jakartaDateKey(now) >= jakartaDateKey(startsAt);
}

/** Kalimat feed `event_going`. Tense dihitung saat dibaca, bukan payload beku. */
export function eventGoingActivityBody(
  name: string | null,
  startsAt: Date | null,
  now: Date = new Date(),
): string {
  const verb = eventDateReached(startsAt, now)
    ? "Hadir di"
    : "Berencana hadir di";
  const label = name?.trim() ? `"${name.trim()}"` : "acara";
  return `${verb} ${label}`;
}
