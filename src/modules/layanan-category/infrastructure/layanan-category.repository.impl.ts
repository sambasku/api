import { and, asc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { layananCategories } from '@/shared/database/drizzle/schema/layanan-categories.schema';
import { layanans } from '@/shared/database/drizzle/schema/layanans.schema';
import { ConflictError } from '@/shared/errors/app-error';
import type { LayananCategoryRecord } from '../domain/entities/layanan-category.entity';
import type {
  CreateLayananCategoryInput,
  LayananCategoryRepository,
  UpdateLayananCategoryInput,
} from '../domain/repositories/layanan-category.repository';

type Row = typeof layananCategories.$inferSelect;

function mapRow(row: Row): LayananCategoryRecord {
  return {
    id: row.id,
    name: row.name,
    shortLabel: row.shortLabel,
    icon: row.icon,
    status: row.status,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
  };
}

export class LayananCategoryRepositoryImpl implements LayananCategoryRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: CreateLayananCategoryInput): Promise<LayananCategoryRecord> {
    try {
      await this.db.insert(layananCategories).values({
        id: input.id,
        name: input.name,
        shortLabel: input.shortLabel,
        icon: input.icon,
        status: input.status ?? 'published',
        sortOrder: input.sortOrder ?? 0,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('short_label')) {
        throw new ConflictError('CATEGORY_SHORT_LABEL_TAKEN', 'Label singkat sudah dipakai kategori lain');
      }
      if (msg.includes('UNIQUE') || msg.includes('unique')) {
        throw new ConflictError('CATEGORY_ID_TAKEN', 'Id kategori sudah dipakai');
      }
      throw e;
    }
    const created = await this.findById(input.id);
    if (!created) throw new Error('Layanan category create gagal - row tidak ketemu');
    return created;
  }

  async update(input: UpdateLayananCategoryInput): Promise<LayananCategoryRecord | null> {
    const existing = await this.findById(input.id);
    if (!existing) return null;
    const values: Partial<typeof layananCategories.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) values.name = input.name;
    if (input.shortLabel !== undefined) values.shortLabel = input.shortLabel;
    if (input.icon !== undefined) values.icon = input.icon;
    if (input.status !== undefined) values.status = input.status;
    if (input.sortOrder !== undefined) values.sortOrder = input.sortOrder;
    try {
      await this.db
        .update(layananCategories)
        .set(values)
        .where(and(eq(layananCategories.id, input.id), isNull(layananCategories.deletedAt)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('short_label') || msg.includes('UNIQUE') || msg.includes('unique')) {
        throw new ConflictError('CATEGORY_SHORT_LABEL_TAKEN', 'Label singkat sudah dipakai kategori lain');
      }
      throw e;
    }
    return this.findById(input.id);
  }

  async softDelete(id: string): Promise<boolean> {
    const rows = await this.db
      .update(layananCategories)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(layananCategories.id, id), isNull(layananCategories.deletedAt)))
      .returning({ id: layananCategories.id });
    return rows.length > 0;
  }

  async findById(id: string): Promise<LayananCategoryRecord | null> {
    const [row] = await this.db
      .select()
      .from(layananCategories)
      .where(and(eq(layananCategories.id, id), isNull(layananCategories.deletedAt)))
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async list(input: {
    publicOnly: boolean;
    status?: LayananCategoryRecord['status'];
  }): Promise<LayananCategoryRecord[]> {
    const conds = [isNull(layananCategories.deletedAt)];
    if (input.publicOnly) {
      // Archived tetap tampil selama masih ada layanan terbit (layanan lama tidak boleh hilang dari publik).
      conds.push(
        or(
          eq(layananCategories.status, 'published'),
          inArray(
            layananCategories.id,
            this.db
              .select({ category: layanans.category })
              .from(layanans)
              .where(eq(layanans.publishStatus, 'published')),
          ),
        )!,
      );
    } else if (input.status) {
      conds.push(eq(layananCategories.status, input.status));
    }
    const rows = await this.db
      .select()
      .from(layananCategories)
      .where(and(...conds))
      .orderBy(asc(layananCategories.sortOrder), asc(layananCategories.name));
    return rows.map(mapRow);
  }

  async countLayananUsing(categoryId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)` })
      .from(layanans)
      .where(eq(layanans.category, categoryId));
    return Number(row?.n ?? 0);
  }
}
