import type {
  EventCategoryRef,
  EventComment,
  EventListItem,
  EventPlaceRef,
  EventSourceType,
  EventStatus,
  EventVillageRef,
} from "../entities/event.entity";
import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';

export interface NewEventCommentInput {
  eventId: string;
  userId: string;
  body: string;
  bodyOriginal: string | null;
}

export interface EventCommentListFilter {
  status?: 'published';
  cursor?: string;
  limit: number;
}

export interface CreateEventInput {
  id?: string;
  slug: string;
  name: string;
  description: string;
  categoryId: string;
  startsAt: Date;
  endsAt: Date;
  locationText: string;
  lat?: number | null;
  lng?: number | null;
  mapsUrl?: string | null;
  posterUrls?: string[];
  organizer?: string | null;
  sourceUrl?: string | null;
  sourceType?: EventSourceType | null;
  sourceAttribution?: string | null;
  regionId?: string | null;
  villageId?: string | null;
  placeIds?: string[];
  authorId?: string | null;
  status?: EventStatus;
}

export interface UpdateEventInput {
  id: string;
  slug?: string;
  name?: string;
  description?: string;
  categoryId?: string;
  startsAt?: Date;
  endsAt?: Date;
  locationText?: string;
  lat?: number | null;
  lng?: number | null;
  mapsUrl?: string | null;
  posterUrls?: string[];
  organizer?: string | null;
  sourceUrl?: string | null;
  sourceType?: EventSourceType | null;
  sourceAttribution?: string | null;
  regionId?: string | null;
  villageId?: string | null;
  placeIds?: string[];
  status?: EventStatus;
  /** Set/clear pembatalan (non-null timestamp = dibatalkan). */
  cancelled?: boolean;
}

export interface ListEventsInput {
  limit: number;
  before?: string;
  categoryId?: string;
  villageId?: string;
  /** Filter kecamatan (ULID atau slug): acara di kecamatan itu + desanya. */
  regionId?: string;
  placeId?: string;
  q?: string;
  status?: EventStatus;
  /** true = hanya published + tidak dihapus (API publik). */
  publicOnly?: boolean;
  /** Filter pelaksanaan read-time: hanya yang belum selesai. */
  notEnded?: boolean;
  /** Urutan by created_at: asc = paling lama dulu; desc = terbaru dulu. */
  order?: "asc" | "desc";
  /**
   * Window overlap (wajib berpasangan): acara yang
   * `starts_at < overlapsTo AND ends_at >= overlapsFrom`.
   * Saat diisi, list diurutkan by `starts_at ASC` (bukan `created_at`).
   */
  overlapsFrom?: Date;
  overlapsTo?: Date;
}

export interface ListEventsResult {
  items: EventListItem[];
  nextCursor: string | null;
}

export interface EventRepository {
  create(input: CreateEventInput): Promise<EventListItem>;
  update(input: UpdateEventInput): Promise<EventListItem | null>;
  softDelete(id: string): Promise<boolean>;
  findById(id: string): Promise<EventListItem | null>;
  findBySlug(slug: string, opts?: { publicOnly?: boolean }): Promise<EventListItem | null>;
  list(input: ListEventsInput): Promise<ListEventsResult>;
  /** Ganti daftar tempat wisata terkait (replace-set, satu transaksi). */
  setPlaces(eventId: string, placeIds: string[]): Promise<void>;
  /** Id-nama tempat wisata untuk event (JOIN). */
  placesOf(eventId: string): Promise<EventPlaceRef[]>;
  /** Ref kategori + desa untuk display (dipakai serializer). */
  categoryRef(categoryId: string): Promise<EventCategoryRef | null>;
  villageRef(villageId: string): Promise<EventVillageRef | null>;
  /**
   * Katalog kategori acara. `publicOnly` = hanya status published.
   * Satu query - dipakai form select di console + filter web.
   */
  listCategories(publicOnly: boolean): Promise<EventCategoryRef[]>;
  /**
   * Validasi batch tempat wisata: kembalikan id yang valid (published).
   * Satu query IN - JANGAN loop await per id (rule subrequest).
   */
  validPlaceIds(placeIds: string[]): Promise<Set<string>>;
  /**
   * Slug yang sudah dipakai di antara kandidat (1 query IN).
   * Dipakai untuk generate slug unik tanpa loop query.
   */
  existingSlugs(slugs: string[]): Promise<Set<string>>;

  // --- komentar ---
  createComment(input: NewEventCommentInput): Promise<EventComment>;
  findCommentById(id: string): Promise<EventComment | null>;
  listComments(eventId: string, filter: EventCommentListFilter): Promise<CursorPage<EventComment>>;
  updateCommentWithRevision(input: {
    commentId: string;
    editorId: string;
    body: string;
  }): Promise<EventComment | null>;
  markCommentDeletedByAuthor(id: string, actorId: string): Promise<boolean>;
  takedownComment(id: string, actorId: string): Promise<boolean>;
  /** Cek event masih published (dipakai use case sebelum create comment). */
  eventTargetExists(id: string): Promise<boolean>;
}
