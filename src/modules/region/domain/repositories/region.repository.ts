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

/** Katalog publik untuk peta Wilayah. `id` dan `parentId` = slug (sama geojson / regions.json). */
export interface RegionCatalogItem {
  id: string;
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
  list(input: ListRegionsInput): Promise<ListRegionsResult>;
  listPublishedCatalog(): Promise<RegionCatalogItem[]>;
  countActiveChildren(parentId: string): Promise<number>;
  countPlacesUsing(regionId: string): Promise<number>;
}
