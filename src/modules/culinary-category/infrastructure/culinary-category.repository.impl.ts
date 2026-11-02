import { and, desc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { culinaryCategories } from '@/shared/database/drizzle/schema/culinary-categories.schema';
import { cuisines } from '@/shared/database/drizzle/schema/cuisines.schema';
import { ilikeCompat } from '@/shared/database/drizzle/ilike-compat';
import { ConflictError } from '@/shared/errors/app-error';
import type { CulinaryCategoryRecord } from '../domain/entities/culinary-category.entity';
import type {
  CreateCulinaryCategoryInput,
  ListKulinerCategoriesInput,
  ListKulinerCategoriesResult,
  UpdateCulinaryCategoryInput,
  CulinaryCategoryRepository,
} from '../domain/repositories/culinary-category.repository';

type Row = typeof culinaryCategories.$inferSelect;

function mapRow(row: Row): CulinaryCategoryRecord {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
  };
}

export class CulinaryCategoryRepositoryImpl implements CulinaryCategoryRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: CreateCulinaryCategoryInput): Promise<CulinaryCategoryRecord> {
    try {
      await this.db.insert(culinaryCategories).values({
        id: input.id,
        name: input.name,
        status: input.status ?? 'published',
        sortOrder: input.sortOrder ?? 0,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('UNIQUE') || msg.includes('unique')) {
        throw new ConflictError('CATEGORY_ID_TAKEN', 'Id kategori sudah dipakai');
      }
      throw e;
    }
    const created = await this.findById(input.id);
    if (!created) throw new Error('Kuliner category create gagal - row tidak ketemu');
    return created;
  }

  async update(
    input: UpdateCulinaryCategoryInput,
  ): Promise<CulinaryCategoryRecord | null> {
    const existing = await this.findById(input.id);
    if (!existing) return null;
    const values: Partial<typeof culinaryCategories.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.name !== undefined) values.name = input.name;
    if (input.status !== undefined) values.status = input.status;
    if (input.sortOrder !== undefined) values.sortOrder = input.sortOrder;
    await this.db
      .update(culinaryCategories)
      .set(values)
      .where(
        and(
          eq(culinaryCategories.id, input.id),
          isNull(culinaryCategories.deletedAt),
        ),
      );
    return this.findById(input.id);
  }

  async softDelete(id: string): Promise<boolean> {
    const rows = await this.db
      .update(culinaryCategories)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(culinaryCategories.id, id), isNull(culinaryCategories.deletedAt)))
      .returning({ id: culinaryCategories.id });
    return rows.length > 0;
  }

  async findById(id: string): Promise<CulinaryCategoryRecord | null> {
    const [row] = await this.db
      .select()
      .from(culinaryCategories)
      .where(and(eq(culinaryCategories.id, id), isNull(culinaryCategories.deletedAt)))
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async list(
    input: ListKulinerCategoriesInput,
  ): Promise<ListKulinerCategoriesResult> {
    const conds = [isNull(culinaryCategories.deletedAt)];
    if (input.publicOnly) conds.push(eq(culinaryCategories.status, 'published'));
    else if (input.status) conds.push(eq(culinaryCategories.status, input.status));
    if (input.q?.trim()) {
      const q = `%${input.q.trim()}%`;
      conds.push(
        or(
          ilikeCompat(culinaryCategories.name, q),
          ilikeCompat(culinaryCategories.id, q),
        )!,
      );
    }
    if (input.before) conds.push(lt(culinaryCategories.id, input.before));

    const rows = await this.db
      .select()
      .from(culinaryCategories)
      .where(and(...conds))
      .orderBy(
        culinaryCategories.sortOrder,
        culinaryCategories.name,
        desc(culinaryCategories.id),
      )
      .limit(input.limit + 1);

    const hasMore = rows.length > input.limit;
    const page = hasMore ? rows.slice(0, input.limit) : rows;
    const items = page.map(mapRow);
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async countCuisinesUsing(categoryId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)` })
      .from(cuisines)
      .where(and(isNull(cuisines.deletedAt), eq(cuisines.categoryId, categoryId)));
    return Number(row?.n ?? 0);
  }
}
