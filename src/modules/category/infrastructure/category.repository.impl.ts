import { asc, isNull, sql } from 'drizzle-orm';
import { categories } from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type { Category } from '../domain/entities/category.entity';
import type { CategoryRepository } from '../domain/repositories/category.repository';

export class CategoryRepositoryImpl implements CategoryRepository {
  constructor(private readonly db: AppDatabase) {}

  async listCategories(): Promise<Category[]> {
    // word_count via subquery select (1 query, bukan N+1 - api#50).
    const rows = await this.db
      .select({
        id: categories.id,
        parentId: categories.parentId,
        name: categories.name,
        description: categories.description,
        wordCount: sql<number>`(
          select count(*) from word_categories wc
          where wc.category_id = ${categories.id}
        )`,
      })
      .from(categories)
      .where(isNull(categories.deletedAt))
      .orderBy(asc(categories.name));
    return rows.map((r) => ({
      id: r.id,
      parentId: r.parentId,
      name: r.name,
      description: r.description,
      wordCount: Number(r.wordCount) || 0,
    }));
  }

  async existsActiveNameCaseInsensitive(name: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: categories.id })
      .from(categories)
      .where(sql`${categories.deletedAt} is null and lower(${categories.name}) = lower(${name})`)
      .limit(1);
    return rows.length > 0;
  }

  async findActiveByNameCaseInsensitive(name: string): Promise<Category | null> {
    const rows = await this.db
      .select()
      .from(categories)
      .where(sql`${categories.deletedAt} is null and lower(${categories.name}) = lower(${name})`)
      .limit(1);
    const r = rows[0];
    if (!r) return null;
    return { id: r.id, parentId: r.parentId, name: r.name, description: r.description };
  }

  async create(input: { name: string; description?: string | null }): Promise<Category> {
    const rows = await this.db
      .insert(categories)
      .values({ name: input.name, description: input.description ?? null })
      .returning();
    const r = rows[0];
    return { id: r.id, parentId: r.parentId, name: r.name, description: r.description };
  }
}