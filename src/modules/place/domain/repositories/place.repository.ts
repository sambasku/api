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
} from '../entities/place.entity';

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

export interface PlaceRepository {
  create(input: CreatePlaceInput): Promise<Place>;
  update(input: UpdatePlaceInput): Promise<Place | null>;
  softDelete(id: string): Promise<boolean>;
  findById(id: string): Promise<Place | null>;
  findBySlug(slug: string, opts?: { publicOnly?: boolean }): Promise<Place | null>;
  list(input: ListPlacesInput): Promise<ListPlacesResult>;
  findBySlugAny(slug: string): Promise<Place | null>;
  listImages(placeId: string, offset: number, limit: number): Promise<{ items: PlaceImage[]; total: number }>;
  appendImages(placeId: string, images: PlaceImageInput[]): Promise<void>;
  countUploadsSince(placeId: string, authorId: string, since: Date): Promise<number>;
  resolveRelated(related: PlaceRelation[]): Promise<PlaceRelatedCard[]>;
}
