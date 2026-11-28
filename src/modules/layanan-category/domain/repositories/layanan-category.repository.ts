import type {
  LayananCategoryRecord,
  LayananCategoryStatus,
} from '../entities/layanan-category.entity';

export interface CreateLayananCategoryInput {
  id: string;
  name: string;
  shortLabel: string;
  icon: string;
  status?: LayananCategoryStatus;
  sortOrder?: number;
}

export interface UpdateLayananCategoryInput {
  id: string;
  name?: string;
  shortLabel?: string;
  icon?: string;
  status?: LayananCategoryStatus;
  sortOrder?: number;
}

export interface LayananCategoryRepository {
  create(input: CreateLayananCategoryInput): Promise<LayananCategoryRecord>;
  update(input: UpdateLayananCategoryInput): Promise<LayananCategoryRecord | null>;
  softDelete(id: string): Promise<boolean>;
  findById(id: string): Promise<LayananCategoryRecord | null>;
  /** Publik: published + archived yang masih punya layanan terbit. Admin: semua (opsional filter status). */
  list(input: { publicOnly: boolean; status?: LayananCategoryStatus }): Promise<LayananCategoryRecord[]>;
  countLayananUsing(categoryId: string): Promise<number>;
}
