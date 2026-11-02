import type { Region, RegionStatus, RegionType } from '../entities/region.entity';

export interface CreateRegionInput {
  slug: string;
  name: string;
  type: RegionType;
  parentId?: string | null;
  code?: string | null;
  lat?: number | null;
  lng?: number | null;
  status?: RegionStatus;
  sortOrder?: number;
}

export interface UpdateRegionInput {
  id: string;
  name?: string;
  parentId?: string | null;
  code?: string | null;
  lat?: number | null;
  lng?: number | null;
  status?: RegionStatus;
  sortOrder?: number;
}

export interface ListRegionsInput {
  limit: number;
  before?: string;
  type?: RegionType;
  parentId?: string;
  q?: string;
  status?: RegionStatus;
  publicOnly?: boolean;
}

export interface ListRegionsResult {
  items: Region[];
  nextCursor: string | null;
}

/**
 * Katalog publik untuk peta + form (profil/usaha/acara).
 * `id` / `parentId` = ULID (FK tulis-path); `slug` = kunci geojson / CDN.
 */
export interface RegionCatalogItem {
  id: string;
  slug: string;
  name: string;
  type: RegionType;
  parentId: string | null;
  code: string | null;
  lat: number | null;
  lng: number | null;
}

export interface RegionRepository {
  create(input: CreateRegionInput): Promise<Region>;
  update(input: UpdateRegionInput): Promise<Region | null>;
  softDelete(id: string): Promise<boolean>;
  findById(id: string, opts?: { includeDeleted?: boolean }): Promise<Region | null>;
  findBySlug(slug: string): Promise<Region | null>;
  /**
   * Terima ULID (FK) atau slug publik dalam satu query.
   * Tulis-path wajib resolve ke ULID sebelum simpan.
   */
  findByIdOrSlug(ref: string, opts?: { includeDeleted?: boolean }): Promise<Region | null>;
  list(input: ListRegionsInput): Promise<ListRegionsResult>;
  listPublishedCatalog(): Promise<RegionCatalogItem[]>;
  countActiveChildren(parentId: string): Promise<number>;
  countPlacesUsing(regionId: string): Promise<number>;
}
