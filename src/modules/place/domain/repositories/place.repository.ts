import type {
  Place,
  PlaceCategory,
  PlaceImage,
  PlaceImageAttribution,
  PlaceRelatedCard,
  PlaceRelation,
  PlaceSource,
  PlaceStatus,
  PlaceType,
} from "../entities/place.entity";

export interface PlaceImageInput {
  url: string;
  isMain?: boolean;
  sortOrder?: number;
  attribution?: PlaceImageAttribution | null;
}

export interface CreatePlaceInput {
  id?: string;
  slug: string;
  name: string;
  category: PlaceCategory;
  type?: PlaceType | null;
  lat?: number | null;
  lng?: number | null;
  mapsUrl?: string | null;
  shortDescription: string;
  regionId?: string | null;
  villageId?: string | null;
  hours?: string | null;
  contact?: string | null;
  authorId?: string | null;
  sources?: PlaceSource[];
  related?: PlaceRelation[];
  images?: PlaceImageInput[];
  status?: PlaceStatus;
}

export interface UpdatePlaceInput {
  id: string;
  slug?: string;
  name?: string;
  category?: PlaceCategory;
  type?: PlaceType | null;
  lat?: number | null;
  lng?: number | null;
  mapsUrl?: string | null;
  shortDescription?: string;
  regionId?: string | null;
  villageId?: string | null;
  hours?: string | null;
  contact?: string | null;
  authorId?: string | null;
  sources?: PlaceSource[];
  related?: PlaceRelation[];
  images?: PlaceImageInput[];
  status?: PlaceStatus;
}

export interface ListPlacesInput {
  limit: number;
  before?: string;
  category?: PlaceCategory;
  type?: PlaceType;
  regionId?: string;
  villageId?: string;
  /** Hanya place tanpa desa (village_id null), biasanya bersama regionId. */
  villageUnset?: boolean;
  q?: string;
  status?: PlaceStatus;
  /** true = hanya published + not deleted (publik). */
  publicOnly?: boolean;
}

export interface ListPlacesResult {
  items: Place[];
  nextCursor: string | null;
}

/** Laporan view untuk halaman analitik console (/admin/places/views/daily). */
export interface PlaceViewReport {
  /** Total view per hari (semua place digabung), urut hari naik. */
  trend: Array<{ day: string; total: number }>;
  /** Per place published yang punya view, urut total desc. */
  items: Array<{
    placeId: string;
    name: string;
    slug: string;
    category: string;
    views: number;
    lastViewed: string | null;
  }>;
}

export interface PlaceRepository {
  create(input: CreatePlaceInput): Promise<Place>;
  update(input: UpdatePlaceInput): Promise<Place | null>;
  softDelete(id: string): Promise<boolean>;
  findById(id: string): Promise<Place | null>;
  findBySlug(
    slug: string,
    opts?: { publicOnly?: boolean },
  ): Promise<Place | null>;
  list(input: ListPlacesInput): Promise<ListPlacesResult>;
  findBySlugAny(slug: string): Promise<Place | null>;
  /** Cek daftar slug mana yang sudah terpakai (bulk check). */
  existingSlugs(slugs: string[]): Promise<Set<string>>;
  listImages(
    placeId: string,
    offset: number,
    limit: number,
  ): Promise<{ items: PlaceImage[]; total: number }>;
  appendImages(placeId: string, images: PlaceImageInput[]): Promise<void>;
  /** #187: sembunyikan satu foto (takedown admin). Null = tak ditemukan. */
  hideImage(placeId: string, imageId: string): Promise<{ url: string } | null>;
  countUploadsSince(
    placeId: string,
    authorId: string,
    since: Date,
  ): Promise<number>;
  resolveRelated(related: PlaceRelation[]): Promise<PlaceRelatedCard[]>;
  /**
   * Catat 1 view untuk 1 pembaca. Idempoten per (place, hari, viewerKey):
   * refresh berulang = 1 baris.
   * @param viewerKey identitas pembaca (lihat place-views.schema.ts)
   */
  recordView(slug: string, viewerKey: string): Promise<void>;
  /** Total pembaca unik per place_id sejak `days` hari WIB terakhir (null = semua). */
  viewTotals(days: number | null): Promise<Map<string, number>>;
  /** Tren harian + total per place (published) untuk halaman analitik console. */
  viewReport(days: number): Promise<PlaceViewReport>;
}
