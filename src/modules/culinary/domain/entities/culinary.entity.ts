import type {
  CuisinePublishStatus,
} from '@/shared/database/drizzle/schema/cuisines.schema';
import type {
  CulinaryOperationalStatus,
  CulinaryPlaceType,
  CulinaryPublishStatus,
} from '@/shared/database/drizzle/schema/culinary-places.schema';
import type { CulinaryAvailability } from '@/shared/database/drizzle/schema/culinary-place-cuisines.schema';

export interface CulinaryCategoryRef {
  id: string;
  name: string;
}

/** Atribusi gambar - disimpan verbatim (PRD kuliner 13). */
export interface CuisineImage {
  url: string;
  isMain: boolean;
  attribution: {
    name?: string;
    provider?: string;
    url?: string;
    license?: string;
    license_url?: string;
  } | null;
}

export interface CuisineSource {
  name: string;
  type: string;
  address: string;
  license?: string | null;
  licenseUrl?: string | null;
}

export interface Cuisine {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  category: CulinaryCategoryRef | null;
  originRegion: string | null;
  images: CuisineImage[];
  ingredients: string[];
  servingSuggestion: string | null;
  tags: string[];
  sources: CuisineSource[];
  license: string | null;
  publishStatus: CuisinePublishStatus;
  restrictedReason: string | null;
  restrictedAt: Date | null;
  authorId: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface CulinaryPlace {
  id: string;
  slug: string;
  name: string;
  type: CulinaryPlaceType | null;
  description: string | null;
  locationHint: string | null;
  addressText: string | null;
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  socialUrl: string | null;
  coverUrl: string | null;
  operationalStatus: CulinaryOperationalStatus;
  publishStatus: CulinaryPublishStatus;
  restrictedReason: string | null;
  restrictedAt: Date | null;
  managerId: string | null;
  authorId: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

/** Baris relasi kuliner <-> tempat + nama tampil (hasil JOIN). */
export interface CuisinePlaceLink {
  id: string;
  cuisineId: string;
  placeId: string;
  availability: CulinaryAvailability;
  note: string | null;
  publishStatus: CulinaryPublishStatus;
  cuisineName: string | null;
  cuisineSlug: string | null;
  placeName: string | null;
  placeSlug: string | null;
}

export interface CuisineDetail extends Cuisine {
  /** Tempat yang menyediakan kuliner ini (published saja). */
  places: CuisinePlaceLink[];
}

export interface CulinaryPlaceDetail extends CulinaryPlace {
  /** Kuliner yang tersedia di tempat ini (published saja). */
  cuisines: CuisinePlaceLink[];
}

function parseJsonArray<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function mapImages(raw: string | null): CuisineImage[] {
  return parseJsonArray<Record<string, unknown>>(raw).map((img) => ({
    url: String(img.url ?? ''),
    isMain: img.isMain === true,
    attribution: (img.attribution as CuisineImage['attribution']) ?? null,
  }));
}

export function mapSources(raw: string | null): CuisineSource[] {
  return parseJsonArray<Record<string, unknown>>(raw).map((src) => ({
    name: String(src.name ?? ''),
    type: String(src.type ?? 'other'),
    address: String(src.address ?? ''),
    license: (src.license as string | null) ?? null,
    licenseUrl: (src.licenseUrl as string | null) ?? null,
  }));
}

export { parseJsonArray };
