import { and, desc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { usahaCategories } from '@/shared/database/drizzle/schema/usaha-categories.schema';
import { usahas } from '@/shared/database/drizzle/schema/usahas.schema';
import { ilikeCompat } from '@/shared/database/drizzle/ilike-compat';
import { ConflictError } from '@/shared/errors/app-error';
import type { UsahaCategoryRecord } from '../domain/entities/usaha-category.entity';
import type {
  CreateUsahaCategoryInput,
  ListUsahaCategoriesInput,
  ListUsahaCategoriesResult,
  UpdateUsahaCategoryInput,
  UsahaCategoryRepository,
} from '../domain/repositories/usaha-category.repository';

type Row = typeof usahaCategories.$inferSelect;

function mapRow(row: Row): UsahaCategoryRecord {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
  };
}

export class UsahaCategoryRepositoryImpl implements UsahaCategoryRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: CreateUsahaCategoryInput): Promise<UsahaCategoryRecord> {
    try {
      await this.db.insert(usahaCategories).values({
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
    if (!created) throw new Error('Usaha category create gagal - row tidak ketemu');
    return created;
  }

  async update(
    input: UpdateUsahaCategoryInput,
  ): Promise<UsahaCategoryRecord | null> {
    const existing = await this.findById(input.id);
    if (!existing) return null;
    const values: Partial<typeof usahaCategories.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.name !== undefined) values.name = input.name;
    if (input.status !== undefined) values.status = input.status;
    if (input.sortOrder !== undefined) values.sortOrder = input.sortOrder;
    await this.db
      .update(usahaCategories)
      .set(values)
      .where(
        and(
          eq(usahaCategories.id, input.id),
          isNull(usahaCategories.deletedAt),
        ),
      );
    return this.findById(input.id);
  }

  async softDelete(id: string): Promise<boolean> {
    const rows = await this.db
      .update(usahaCategories)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(usahaCategories.id, id), isNull(usahaCategories.deletedAt)))
      .returning({ id: usahaCategories.id });
    return rows.length > 0;
  }

  async findById(id: string): Promise<UsahaCategoryRecord | null> {
    const [row] = await this.db
      .select()
      .from(usahaCategories)
      .where(and(eq(usahaCategories.id, id), isNull(usahaCategories.deletedAt)))
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async list(
    input: ListUsahaCategoriesInput,
  ): Promise<ListUsahaCategoriesResult> {
    const conds = [isNull(usahaCategories.deletedAt)];
    if (input.publicOnly) conds.push(eq(usahaCategories.status, 'published'));
    else if (input.status) conds.push(eq(usahaCategories.status, input.status));
    if (input.q?.trim()) {
      const q = `%${input.q.trim()}%`;
      conds.push(
        or(
          ilikeCompat(usahaCategories.name, q),
          ilikeCompat(usahaCategories.id, q),
        )!,
      );
    }
    if (input.before) conds.push(lt(usahaCategories.id, input.before));

    const rows = await this.db
      .select()
      .from(usahaCategories)
      .where(and(...conds))
      .orderBy(
        usahaCategories.sortOrder,
        usahaCategories.name,
        desc(usahaCategories.id),
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

  async countUsahaUsing(categoryId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)` })
      .from(usahas)
      .where(and(isNull(usahas.deletedAt), eq(usahas.categoryId, categoryId)));
    return Number(row?.n ?? 0);
  }
}
