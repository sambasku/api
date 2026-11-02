import type {
  CulinaryCategoryRecord,
  CulinaryCategoryStatus,
} from '../entities/culinary-category.entity';

export interface CreateCulinaryCategoryInput {
  id: string;
  name: string;
  status?: CulinaryCategoryStatus;
  sortOrder?: number;
}

export interface UpdateCulinaryCategoryInput {
  id: string;
  name?: string;
  status?: CulinaryCategoryStatus;
  sortOrder?: number;
}

export interface ListKulinerCategoriesInput {
  limit: number;
  before?: string;
  q?: string;
  status?: CulinaryCategoryStatus;
  publicOnly?: boolean;
}

export interface ListKulinerCategoriesResult {
  items: CulinaryCategoryRecord[];
  nextCursor: string | null;
}

export interface CulinaryCategoryRepository {
  create(input: CreateCulinaryCategoryInput): Promise<CulinaryCategoryRecord>;
  update(input: UpdateCulinaryCategoryInput): Promise<CulinaryCategoryRecord | null>;
  softDelete(id: string): Promise<boolean>;
  findById(id: string): Promise<CulinaryCategoryRecord | null>;
  list(input: ListKulinerCategoriesInput): Promise<ListKulinerCategoriesResult>;
  countCuisinesUsing(categoryId: string): Promise<number>;
}
