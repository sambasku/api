import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import {
  stickers,
  userStickerFavorites,
} from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type {
  Sticker,
  StickerListPage,
  StickerVisibility,
} from '../domain/entities/sticker.entity';
import type {
  AdminStickerVisibilityFilter,
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
    ownerUserId: r.ownerUserId ?? null,
    displayName: r.displayName ?? null,
    visibility: (r.visibility === 'private' ? 'private' : 'public') as StickerVisibility,
    providerFileId: r.providerFileId ?? null,
    sourceStickerId: r.sourceStickerId ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt ?? null,
    deletedAt: r.deletedAt ?? null,
  };
}

/**
 * Stiker yang dihapus pemiliknya tetap terlihat oleh favoriter lama (referensi).
 * Salinan milik favoriter sendiri tidak masuk: penghapusannya berarti hilang dari deck.
 */
function ownerDeletedFavorite(userId: string) {
  return and(
    isNotNull(stickers.deletedAt),
    isNotNull(stickers.ownerUserId),
    ne(stickers.ownerUserId, userId),
    eq(stickers.visibility, 'private'),
  );
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
      eq(stickers.visibility, 'public'),
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
          eq(stickers.visibility, 'public'),
          isNotNull(stickers.categorySlug),
          sql`trim(${stickers.categorySlug}) != ''`,
        ),
      )
      .orderBy(asc(stickers.categorySlug));
    return rows
      .map((r) => r.categorySlug)
      .filter((s): s is string => Boolean(s && s.trim()));
  }

  async listAll(
    visibility: AdminStickerVisibilityFilter = 'all',
  ): Promise<Sticker[]> {
    const conds = [isNull(stickers.deletedAt)];
    if (visibility === 'public' || visibility === 'private') {
      conds.push(eq(stickers.visibility, visibility));
    }
    const rows = await this.db
      .select()
      .from(stickers)
      .where(and(...conds))
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

  async findUsableByUser(id: string, userId: string): Promise<Sticker | null> {
    const rows = await this.db
      .select({ sticker: stickers })
      .from(stickers)
      .leftJoin(
        userStickerFavorites,
        and(
          eq(userStickerFavorites.stickerId, stickers.id),
          eq(userStickerFavorites.userId, userId),
        ),
      )
      .where(
        and(
          eq(stickers.id, id),
          or(
            and(
              isNull(stickers.deletedAt),
              eq(stickers.isActive, true),
              or(
                eq(stickers.visibility, 'public'),
                eq(stickers.ownerUserId, userId),
                isNotNull(userStickerFavorites.userId),
              ),
            ),
            and(
              isNotNull(userStickerFavorites.userId),
              ownerDeletedFavorite(userId),
            ),
          ),
        ),
      )
      .limit(1);
    const r = rows[0]?.sticker;
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
        ownerUserId: input.ownerUserId ?? null,
        displayName: input.displayName ?? null,
        visibility: input.visibility ?? 'public',
        providerFileId: input.providerFileId ?? null,
        sourceStickerId: input.sourceStickerId ?? null,
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
    if (input.displayName !== undefined) {
      values.displayName = input.displayName;
    }
    const rows = await this.db
      .update(stickers)
      .set(values)
      .where(and(eq(stickers.id, id), isNull(stickers.deletedAt)))
      .returning();
    const r = rows[0];
    return r ? mapRow(r) : null;
  }

  async softDelete(id: string): Promise<Sticker | null> {
    const rows = await this.db
      .update(stickers)
      .set({ deletedAt: new Date(), updatedAt: new Date(), isActive: false })
      .where(and(eq(stickers.id, id), isNull(stickers.deletedAt)))
      .returning();
    const r = rows[0];
    return r ? mapRow(r) : null;
  }

  async softDeleteByOwner(
    id: string,
    ownerUserId: string,
  ): Promise<Sticker | null> {
    const rows = await this.db
      .update(stickers)
      .set({ deletedAt: new Date(), updatedAt: new Date(), isActive: false })
      .where(
        and(
          eq(stickers.id, id),
          eq(stickers.ownerUserId, ownerUserId),
          isNull(stickers.deletedAt),
        ),
      )
      .returning();
    const r = rows[0];
    return r ? mapRow(r) : null;
  }

  async listFavorites(userId: string): Promise<Sticker[]> {
    const rows = await this.db
      .select({ sticker: stickers })
      .from(userStickerFavorites)
      .innerJoin(stickers, eq(userStickerFavorites.stickerId, stickers.id))
      .where(
        and(
          eq(userStickerFavorites.userId, userId),
          or(
            and(eq(stickers.isActive, true), isNull(stickers.deletedAt)),
            ownerDeletedFavorite(userId),
          ),
        ),
      )
      .orderBy(desc(userStickerFavorites.createdAt), asc(stickers.id));
    return rows.map((r) => mapRow(r.sticker));
  }

  async countFavorites(userId: string): Promise<number> {
    const rows = await this.db
      .select({ total: count() })
      .from(userStickerFavorites)
      .innerJoin(stickers, eq(userStickerFavorites.stickerId, stickers.id))
      .where(
        and(
          eq(userStickerFavorites.userId, userId),
          or(
            and(eq(stickers.isActive, true), isNull(stickers.deletedAt)),
            ownerDeletedFavorite(userId),
          ),
        ),
      );
    return Number(rows[0]?.total ?? 0);
  }

  async isFavorite(userId: string, stickerId: string): Promise<boolean> {
    const rows = await this.db
      .select({ stickerId: userStickerFavorites.stickerId })
      .from(userStickerFavorites)
      .where(
        and(
          eq(userStickerFavorites.userId, userId),
          eq(userStickerFavorites.stickerId, stickerId),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  async addFavorite(userId: string, stickerId: string): Promise<void> {
    await this.db
      .insert(userStickerFavorites)
      .values({ userId, stickerId })
      .onConflictDoNothing();
  }

  async removeFavorite(userId: string, stickerId: string): Promise<void> {
    await this.db
      .delete(userStickerFavorites)
      .where(
        and(
          eq(userStickerFavorites.userId, userId),
          eq(userStickerFavorites.stickerId, stickerId),
        ),
      );
  }

  async findOwnedCopy(
    ownerUserId: string,
    sourceStickerId: string,
  ): Promise<Sticker | null> {
    const rows = await this.db
      .select()
      .from(stickers)
      .where(
        and(
          eq(stickers.ownerUserId, ownerUserId),
          eq(stickers.sourceStickerId, sourceStickerId),
          isNull(stickers.deletedAt),
        ),
      )
      .limit(1);
    const r = rows[0];
    return r ? mapRow(r) : null;
  }

  async isStickerFileInUse(
    stickerId: string,
    providerFileId: string,
  ): Promise<boolean> {
    const sharing = await this.db
      .select({ id: stickers.id })
      .from(stickers)
      .where(
        and(
          eq(stickers.providerFileId, providerFileId),
          ne(stickers.id, stickerId),
        ),
      )
      .limit(1);
    if (sharing.length > 0) return true;
    const favorited = await this.db
      .select({ stickerId: userStickerFavorites.stickerId })
      .from(userStickerFavorites)
      .where(eq(userStickerFavorites.stickerId, stickerId))
      .limit(1);
    return favorited.length > 0;
  }

  async clearFavoritesOf(stickerId: string): Promise<void> {
    await this.db
      .delete(userStickerFavorites)
      .where(eq(userStickerFavorites.stickerId, stickerId));
  }

  async listByOwner(ownerUserId: string): Promise<Sticker[]> {
    const rows = await this.db
      .select()
      .from(stickers)
      .where(
        and(
          eq(stickers.ownerUserId, ownerUserId),
          eq(stickers.isActive, true),
          isNull(stickers.deletedAt),
          isNull(stickers.sourceStickerId),
        ),
      )
      .orderBy(desc(stickers.createdAt), asc(stickers.id));
    return rows.map(mapRow);
  }

  async countActiveByOwner(ownerUserId: string): Promise<number> {
    const rows = await this.db
      .select({ total: count() })
      .from(stickers)
      .where(
        and(
          eq(stickers.ownerUserId, ownerUserId),
          eq(stickers.isActive, true),
          isNull(stickers.deletedAt),
          isNull(stickers.sourceStickerId),
        ),
      );
    return Number(rows[0]?.total ?? 0);
  }
}
