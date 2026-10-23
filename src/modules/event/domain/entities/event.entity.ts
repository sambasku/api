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
  startsAt: Date;
  endsAt: Date;
  /** Lokasi aktual acara. Independen dari relasi wisata/desa (PRD 6.3). */
  locationText: string;
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  posterUrl: string | null;
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
  /** Id-nama tempat wisata terkait (dipaket dari JOIN). */
  places: EventPlaceRef[];
  createdAt: Date;
  updatedAt: Date | null;
}

export interface EventPlaceRef {
  id: string;
  slug: string;
  name: string;
  category: string | null;
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

/**
 * Status pelaksanaan dari jadwal + pembatalan. `now` bisa diinject agar
 * deterministik di test.
 */
export function occurrenceStatus(
  event: Pick<Event, "startsAt" | "endsAt" | "cancelledAt">,
  now: Date = new Date(),
): EventOccurrenceStatus {
  if (event.cancelledAt) return "cancelled";
  if (now < event.startsAt) return "upcoming";
  if (now > event.endsAt) return "completed";
  return "ongoing";
}
