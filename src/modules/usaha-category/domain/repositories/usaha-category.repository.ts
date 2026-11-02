import type {
  UsahaCategoryRecord,
  UsahaCategoryStatus,
} from '../entities/usaha-category.entity';

export interface CreateUsahaCategoryInput {
  id: string;
  name: string;
  status?: UsahaCategoryStatus;
  sortOrder?: number;
}

export interface UpdateUsahaCategoryInput {
  id: string;
  name?: string;
  status?: UsahaCategoryStatus;
  sortOrder?: number;
}

export interface ListUsahaCategoriesInput {
  limit: number;
  before?: string;
  q?: string;
  status?: UsahaCategoryStatus;
  publicOnly?: boolean;
}

export interface ListUsahaCategoriesResult {
  items: UsahaCategoryRecord[];
  nextCursor: string | null;
}

export interface UsahaCategoryRepository {
  create(input: CreateUsahaCategoryInput): Promise<UsahaCategoryRecord>;
  update(input: UpdateUsahaCategoryInput): Promise<UsahaCategoryRecord | null>;
  softDelete(id: string): Promise<boolean>;
  findById(id: string): Promise<UsahaCategoryRecord | null>;
  list(input: ListUsahaCategoriesInput): Promise<ListUsahaCategoriesResult>;
  countUsahaUsing(categoryId: string): Promise<number>;
}
