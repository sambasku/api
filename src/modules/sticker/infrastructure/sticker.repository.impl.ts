import { and, asc, eq, gt, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { stickers } from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type { Sticker, StickerListPage } from '../domain/entities/sticker.entity';
import type {
  CreateStickerInput,
  ListActiveStickersQuery,
  StickerRepository,
  UpdateStickerInput,
} from '../domain/repositories/sticker.repository';

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;

function mapRow(r: typeof stickers.$inferSelect): Sticker {
  return {
    id: r.id,
    imageUrl: r.imageUrl,
    playOnce: Boolean(r.playOnce),
    sortOrder: r.sortOrder,
    isActive: Boolean(r.isActive),
    categorySlug: r.categorySlug ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt ?? null,
    deletedAt: r.deletedAt ?? null,
  };
}

function encodeCursor(sortOrder: number, id: string): string {
  return `${sortOrder}:${id}`;
}

function decodeCursor(
  cursor: string,
): { sortOrder: number; id: string } | null {
  const i = cursor.indexOf(':');
  if (i <= 0) return null;
  const sortOrder = Number(cursor.slice(0, i));
  const id = cursor.slice(i + 1);
  if (!Number.isFinite(sortOrder) || !id) return null;
  return { sortOrder, id };
}

export class StickerRepositoryImpl implements StickerRepository {
  constructor(private readonly db: AppDatabase) {}

  async listActivePage(query: ListActiveStickersQuery): Promise<StickerListPage> {
    const limit = Math.min(
      Math.max(query.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const q = query.q?.trim().toLowerCase() ?? '';
    const categorySlug = query.categorySlug?.trim() || null;
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;

    const conds = [
      isNull(stickers.deletedAt),
      eq(stickers.isActive, true),
    ];
    if (categorySlug) {
      conds.push(eq(stickers.categorySlug, categorySlug));
    }
    if (q) {
      conds.push(sql`lower(${stickers.id}) like ${`%${q}%`}`);
    }
    if (cursor) {
      conds.push(
        or(
          gt(stickers.sortOrder, cursor.sortOrder),
          and(
            eq(stickers.sortOrder, cursor.sortOrder),
            gt(stickers.id, cursor.id),
          ),
        )!,
      );
    }

    const rows = await this.db
      .select()
      .from(stickers)
      .where(and(...conds))
      .orderBy(asc(stickers.sortOrder), asc(stickers.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const items = pageRows.map(mapRow);
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last ? encodeCursor(last.sortOrder, last.id) : null;

    const categories = await this.listActiveCategories();
    return { items, nextCursor, categories };
  }

  private async listActiveCategories(): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ categorySlug: stickers.categorySlug })
      .from(stickers)
      .where(
        and(
          isNull(stickers.deletedAt),
          eq(stickers.isActive, true),
          isNotNull(stickers.categorySlug),
          sql`trim(${stickers.categorySlug}) != ''`,
        ),
      )
      .orderBy(asc(stickers.categorySlug));
    return rows
      .map((r) => r.categorySlug)
      .filter((s): s is string => Boolean(s && s.trim()));
  }

  async listAll(): Promise<Sticker[]> {
    const rows = await this.db
      .select()
      .from(stickers)
      .where(isNull(stickers.deletedAt))
      .orderBy(asc(stickers.sortOrder), asc(stickers.id));
    return rows.map(mapRow);
  }

  async findActiveById(id: string): Promise<Sticker | null> {
    const rows = await this.db
      .select()
      .from(stickers)
      .where(
        and(
          eq(stickers.id, id),
          isNull(stickers.deletedAt),
          eq(stickers.isActive, true),
        ),
      )
      .limit(1);
    const r = rows[0];
    return r ? mapRow(r) : null;
  }

  async findById(id: string): Promise<Sticker | null> {
    const rows = await this.db
      .select()
      .from(stickers)
      .where(and(eq(stickers.id, id), isNull(stickers.deletedAt)))
      .limit(1);
    const r = rows[0];
    return r ? mapRow(r) : null;
  }

  async create(input: CreateStickerInput): Promise<Sticker> {
    const rows = await this.db
      .insert(stickers)
      .values({
        id: input.id,
        imageUrl: input.imageUrl,
        playOnce: input.playOnce ?? false,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
        categorySlug: input.categorySlug ?? null,
      })
      .returning();
    return mapRow(rows[0]!);
  }

  async update(id: string, input: UpdateStickerInput): Promise<Sticker | null> {
    const values: Partial<typeof stickers.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.imageUrl !== undefined) values.imageUrl = input.imageUrl;
    if (input.playOnce !== undefined) values.playOnce = input.playOnce;
    if (input.sortOrder !== undefined) values.sortOrder = input.sortOrder;
    if (input.isActive !== undefined) values.isActive = input.isActive;
    if (input.categorySlug !== undefined) {
      values.categorySlug = input.categorySlug;
    }
    const rows = await this.db
      .update(stickers)
      .set(values)
      .where(and(eq(stickers.id, id), isNull(stickers.deletedAt)))
      .returning();
    const r = rows[0];
    return r ? mapRow(r) : null;
  }

  async softDelete(id: string): Promise<boolean> {
    const rows = await this.db
      .update(stickers)
      .set({ deletedAt: new Date(), updatedAt: new Date(), isActive: false })
      .where(and(eq(stickers.id, id), isNull(stickers.deletedAt)))
      .returning({ id: stickers.id });
    return rows.length > 0;
  }
}
