import { and, desc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { placeCategories } from '@/shared/database/drizzle/schema/place-categories.schema';
import { places } from '@/shared/database/drizzle/schema/places.schema';
import { ilikeCompat } from '@/shared/database/drizzle/ilike-compat';
import { ConflictError } from '@/shared/errors/app-error';
import type { PlaceCategoryRecord } from '../domain/entities/place-category.entity';
import type {
  CreatePlaceCategoryInput,
  ListPlaceCategoriesInput,
  ListPlaceCategoriesResult,
  PlaceCategoryRepository,
  UpdatePlaceCategoryInput,
} from '../domain/repositories/place-category.repository';

type Row = typeof placeCategories.$inferSelect;

function mapRow(row: Row): PlaceCategoryRecord {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
  };
}

export class PlaceCategoryRepositoryImpl implements PlaceCategoryRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: CreatePlaceCategoryInput): Promise<PlaceCategoryRecord> {
    try {
      await this.db.insert(placeCategories).values({
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
    if (!created) throw new Error('Place category create gagal - row tidak ketemu');
    return created;
  }

  async update(input: UpdatePlaceCategoryInput): Promise<PlaceCategoryRecord | null> {
    const existing = await this.findById(input.id);
    if (!existing) return null;
    const values: Partial<typeof placeCategories.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) values.name = input.name;
    if (input.status !== undefined) values.status = input.status;
    if (input.sortOrder !== undefined) values.sortOrder = input.sortOrder;
    await this.db
      .update(placeCategories)
      .set(values)
      .where(and(eq(placeCategories.id, input.id), isNull(placeCategories.deletedAt)));
    return this.findById(input.id);
  }

  async softDelete(id: string): Promise<boolean> {
    const rows = await this.db
      .update(placeCategories)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(placeCategories.id, id), isNull(placeCategories.deletedAt)))
      .returning({ id: placeCategories.id });
    return rows.length > 0;
  }

  async findById(id: string): Promise<PlaceCategoryRecord | null> {
    const [row] = await this.db
      .select()
      .from(placeCategories)
      .where(and(eq(placeCategories.id, id), isNull(placeCategories.deletedAt)))
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async list(input: ListPlaceCategoriesInput): Promise<ListPlaceCategoriesResult> {
    const conds = [isNull(placeCategories.deletedAt)];
    if (input.publicOnly) conds.push(eq(placeCategories.status, 'published'));
    else if (input.status) conds.push(eq(placeCategories.status, input.status));
    if (input.q?.trim()) {
      const q = `%${input.q.trim()}%`;
      conds.push(or(ilikeCompat(placeCategories.name, q), ilikeCompat(placeCategories.id, q))!);
    }
    if (input.before) conds.push(lt(placeCategories.id, input.before));

    const rows = await this.db
      .select()
      .from(placeCategories)
      .where(and(...conds))
      .orderBy(placeCategories.sortOrder, placeCategories.name, desc(placeCategories.id))
      .limit(input.limit + 1);

    const hasMore = rows.length > input.limit;
    const page = hasMore ? rows.slice(0, input.limit) : rows;
    const items = page.map(mapRow);
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async countPlacesUsing(categoryId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)` })
      .from(places)
      .where(and(isNull(places.deletedAt), eq(places.category, categoryId)));
    return Number(row?.n ?? 0);
  }
}
