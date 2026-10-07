import type { Category } from '../entities/category.entity';

export interface CategoryRepository {
  listCategories(): Promise<Category[]>;
  /** Case-insensitive: master aktif (undeleted) dengan nama sama (api#50). */
  existsActiveNameCaseInsensitive(name: string): Promise<boolean>;
  findActiveByNameCaseInsensitive(name: string): Promise<Category | null>;
  /** INSERT kategori baru dari approve usulan (api#50). */
  create(input: { name: string; description?: string | null }): Promise<Category>;
}