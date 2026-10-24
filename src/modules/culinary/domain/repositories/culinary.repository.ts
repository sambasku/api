import type {
  CulinaryOperationalStatus,
  CulinaryPlaceType,
  CulinaryPublishStatus,
} from '@/shared/database/drizzle/schema/culinary-places.schema';
import type { CulinaryAvailability } from '@/shared/database/drizzle/schema/culinary-place-cuisines.schema';
import type { CuisinePublishStatus } from '@/shared/database/drizzle/schema/cuisines.schema';
import type {
  Cuisine,
  CuisineDetail,
  CuisinePlaceLink,
  CulinaryCategoryRef,
  CulinaryPlace,
  CulinaryPlaceDetail,
} from '../entities/culinary.entity';

export interface CreateCuisineInput {
  id?: string;
  slug: string;
  name: string;
  description?: string | null;
  categoryId?: string | null;
  originRegion?: string | null;
  imagesJson?: string | null;
  ingredientsJson?: string | null;
  servingSuggestion?: string | null;
  tagsJson?: string | null;
  sourcesJson?: string | null;
  license?: string | null;
  publishStatus?: CuisinePublishStatus;
  authorId?: string | null;
}

export interface UpdateCuisineInput {
  id: string;
  slug?: string;
  name?: string;
  description?: string | null;
  categoryId?: string | null;
  originRegion?: string | null;
  imagesJson?: string | null;
  ingredientsJson?: string | null;
  servingSuggestion?: string | null;
  tagsJson?: string | null;
  sourcesJson?: string | null;
  license?: string | null;
  publishStatus?: CuisinePublishStatus;
  /** null = lepas pembatasan. */
  restricted?: { reason: string } | null;
}

export interface CreatePlaceInput {
  id?: string;
  slug: string;
  name: string;
  type?: CulinaryPlaceType | null;
  description?: string | null;
  locationHint?: string | null;
  addressText?: string | null;
  lat?: number | null;
  lng?: number | null;
  mapsUrl?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  socialUrl?: string | null;
  coverUrl?: string | null;
  operationalStatus?: CulinaryOperationalStatus;
  publishStatus?: CulinaryPublishStatus;
  authorId?: string | null;
}

export interface UpdatePlaceInput {
  id: string;
  slug?: string;
  name?: string;
  type?: CulinaryPlaceType | null;
  description?: string | null;
  locationHint?: string | null;
  addressText?: string | null;
  lat?: number | null;
  lng?: number | null;
  mapsUrl?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  socialUrl?: string | null;
  coverUrl?: string | null;
  operationalStatus?: CulinaryOperationalStatus;
  publishStatus?: CulinaryPublishStatus;
  /** null = lepas pembatasan. */
  restricted?: { reason: string } | null;
}

export interface ListCuisinesInput {
  limit: number;
  before?: string;
  categoryId?: string;
  q?: string;
  status?: CuisinePublishStatus;
  /** true = hanya published + tidak dihapus (API publik). */
  publicOnly?: boolean;
}

export interface ListPlacesInput {
  limit: number;
  before?: string;
  type?: CulinaryPlaceType;
  operationalStatus?: CulinaryOperationalStatus;
  q?: string;
  status?: CulinaryPublishStatus;
  publicOnly?: boolean;
  managerId?: string;
}

export interface ListResult<T> {
  items: T[];
  nextCursor: string | null;
}

export interface CreateLinkInput {
  id?: string;
  cuisineId: string;
  placeId: string;
  availability?: CulinaryAvailability;
  note?: string | null;
  publishStatus?: CulinaryPublishStatus;
  authorId?: string | null;
}

export interface UpdateLinkInput {
  id: string;
  availability?: CulinaryAvailability;
  note?: string | null;
  publishStatus?: CulinaryPublishStatus;
}

export interface CulinaryRepository {
  // -- kuliner --
  createCuisine(input: CreateCuisineInput): Promise<Cuisine>;
  updateCuisine(input: UpdateCuisineInput): Promise<Cuisine | null>;
  softDeleteCuisine(id: string): Promise<boolean>;
  findCuisineById(id: string): Promise<CuisineDetail | null>;
  findCuisineBySlug(
    slug: string,
    opts?: { publicOnly?: boolean },
  ): Promise<CuisineDetail | null>;
  listCuisines(input: ListCuisinesInput): Promise<ListResult<Cuisine>>;
  existingCuisineSlugs(slugs: string[]): Promise<Set<string>>;
  /** Duplikat kandidat nama mirip (normalisasi lowercase-trim, read-only). */
  findCuisineDuplicates(input: {
    q: string;
    excludeId?: string;
  }): Promise<Array<{ id: string; slug: string; name: string }>>;

  // -- tempat/penjual --
  createPlace(input: CreatePlaceInput): Promise<CulinaryPlace>;
  updatePlace(input: UpdatePlaceInput): Promise<CulinaryPlace | null>;
  softDeletePlace(id: string): Promise<boolean>;
  findPlaceById(id: string): Promise<CulinaryPlaceDetail | null>;
  findPlaceBySlug(
    slug: string,
    opts?: { publicOnly?: boolean },
  ): Promise<CulinaryPlaceDetail | null>;
  listPlaces(input: ListPlacesInput): Promise<ListResult<CulinaryPlace>>;
  existingPlaceSlugs(slugs: string[]): Promise<Set<string>>;
  findPlaceDuplicates(input: {
    q: string;
    excludeId?: string;
  }): Promise<Array<{ id: string; slug: string; name: string }>>;

  // -- relasi --
  createLink(input: CreateLinkInput): Promise<CuisinePlaceLink>;
  updateLink(input: UpdateLinkInput): Promise<CuisinePlaceLink | null>;
  softDeleteLink(id: string): Promise<boolean>;
  findLinkById(id: string): Promise<CuisinePlaceLink | null>;
  /** Relasi aktif (belum dihapus) untuk pasangan kuliner-tempat. */
  findLinkByPair(
    cuisineId: string,
    placeId: string,
  ): Promise<CuisinePlaceLink | null>;
  /** Fase read: daftar relasi published untuk kuliner (JOIN nama tempat). */
  linksForCuisine(cuisineId: string): Promise<CuisinePlaceLink[]>;
  /** Fase read: daftar relasi published untuk tempat (JOIN nama kuliner). */
  linksForPlace(placeId: string): Promise<CuisinePlaceLink[]>;

  // -- kategori --
  categoryRef(categoryId: string): Promise<CulinaryCategoryRef | null>;
  listCategories(publicOnly: boolean): Promise<CulinaryCategoryRef[]>;
}
