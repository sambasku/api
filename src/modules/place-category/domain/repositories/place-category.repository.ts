import type { PlaceCategoryRecord, PlaceCategoryStatus } from '../entities/place-category.entity';

export interface CreatePlaceCategoryInput {
  id: string;
  name: string;
  status?: PlaceCategoryStatus;
  sortOrder?: number;
}

export interface UpdatePlaceCategoryInput {
  id: string;
  name?: string;
  status?: PlaceCategoryStatus;
  sortOrder?: number;
}

export interface ListPlaceCategoriesInput {
  limit: number;
  before?: string;
  q?: string;
  status?: PlaceCategoryStatus;
  publicOnly?: boolean;
}

export interface ListPlaceCategoriesResult {
  items: PlaceCategoryRecord[];
  nextCursor: string | null;
}

export interface PlaceCategoryRepository {
  create(input: CreatePlaceCategoryInput): Promise<PlaceCategoryRecord>;
  update(input: UpdatePlaceCategoryInput): Promise<PlaceCategoryRecord | null>;
  softDelete(id: string): Promise<boolean>;
  findById(id: string): Promise<PlaceCategoryRecord | null>;
  list(input: ListPlaceCategoriesInput): Promise<ListPlaceCategoriesResult>;
  countPlacesUsing(categoryId: string): Promise<number>;
}
