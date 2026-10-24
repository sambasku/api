import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { usahas, usahaItems } from '@/shared/database/drizzle/schema/usahas.schema';
import { usahaCategories } from '@/shared/database/drizzle/schema/usaha-categories.schema';
import { regions } from '@/shared/database/drizzle/schema/regions.schema';
import { ilikeCompat } from '@/shared/database/drizzle/ilike-compat';
import { generateId } from '@/shared/utils/ulid';
import { ConflictError } from '@/shared/errors/app-error';
import type {
  UsahaDetail,
  UsahaListItem,
} from '../domain/entities/usaha.entity';
import type {
  CreateUsahaInput,
  ListUsahasInput,
  ListUsahasResult,
  UpdateUsahaInput,
  UsahaRepository,
} from '../domain/repositories/usaha.repository';

type UsahaRow = typeof usahas.$inferSelect;

/** Baris usaha + JOIN kategori & desa (LEFT JOIN, satu query). */
type UsahaJoinedRow = UsahaRow & {
  categoryName: string | null;
  villageName: string | null;
  villageSlug: string | null;
};

const usahaSelect = {
  ...getTableColumns(usahas),
  categoryName: usahaCategories.name,
  villageName: regions.name,
  villageSlug: regions.slug,
};

function mapUsaha(row: UsahaJoinedRow): UsahaListItem {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? null,
    categoryId: row.categoryId ?? null,
    kind: row.kind,
    regionId: row.regionId ?? null,
    villageId: row.villageId ?? null,
    addressText: row.addressText ?? null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    mapsUrl: row.mapsUrl ?? null,
    phone: row.phone ?? null,
    whatsapp: row.whatsapp ?? null,
    website: row.website ?? null,
    socialUrl: row.socialUrl ?? null,
    coverUrl: row.coverUrl ?? null,
    publishStatus: row.publishStatus,
    operationalStatus: row.operationalStatus,
    restrictedReason: row.restrictedReason ?? null,
    restrictedAt: row.restrictedAt ?? null,
    managerId: row.managerId ?? null,
    authorId: row.authorId ?? null,
    publishedAt: row.publishedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
    category: row.categoryName
      ? { id: row.categoryId ?? '', name: row.categoryName }
      : null,
    village:
      row.villageId && row.villageName
        ? {
            id: row.villageId,
            name: row.villageName,
            slug: row.villageSlug ?? null,
          }
        : null,
  };
}

export class UsahaRepositoryImpl implements UsahaRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: CreateUsahaInput): Promise<UsahaListItem> {
    const id = input.id ?? generateId();
    const now = new Date();
    try {
      await this.db.transaction(async (tx) => {
        await tx.insert(usahas).values({
          id,
          slug: input.slug,
          name: input.name,
          description: input.description ?? null,
          categoryId: input.categoryId ?? null,
          kind: input.kind ?? 'product',
          regionId: input.regionId ?? null,
          villageId: input.villageId ?? null,
          addressText: input.addressText ?? null,
          lat: input.lat ?? null,
          lng: input.lng ?? null,
          mapsUrl: input.mapsUrl ?? null,
          phone: input.phone ?? null,
          whatsapp: input.whatsapp ?? null,
          website: input.website ?? null,
          socialUrl: input.socialUrl ?? null,
          coverUrl: input.coverUrl ?? null,
          publishStatus: input.publishStatus ?? 'published',
          operationalStatus: input.operationalStatus ?? 'unknown',
          publishedAt:
            input.publishStatus === undefined || input.publishStatus === 'published'
              ? now
              : null,
          authorId: input.authorId ?? null,
        });
        if (input.items?.length) {
          await tx.insert(usahaItems).values(
            input.items.map((item, i) => ({
              usahaId: id,
              name: item.name,
              description: item.description ?? null,
              priceText: item.priceText ?? null,
              imageUrl: item.imageUrl ?? null,
              sortOrder: i,
            })),
          );
        }
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('UNIQUE') || msg.includes('unique')) {
        throw new ConflictError('SLUG_TAKEN', 'Slug usaha sudah dipakai');
      }
      throw e;
    }
    const created = await this.findById(id);
    if (!created) throw new Error('Usaha create gagal - row tidak ketemu');
    return created;
  }

  async update(input: UpdateUsahaInput): Promise<UsahaListItem | null> {
    const values: Partial<typeof usahas.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.slug !== undefined) values.slug = input.slug;
    if (input.name !== undefined) values.name = input.name;
    if (input.description !== undefined) values.description = input.description;
    if (input.categoryId !== undefined) values.categoryId = input.categoryId;
    if (input.kind !== undefined) values.kind = input.kind;
    if (input.regionId !== undefined) values.regionId = input.regionId;
    if (input.villageId !== undefined) values.villageId = input.villageId;
    if (input.addressText !== undefined) values.addressText = input.addressText;
    if (input.lat !== undefined) values.lat = input.lat;
    if (input.lng !== undefined) values.lng = input.lng;
    if (input.mapsUrl !== undefined) values.mapsUrl = input.mapsUrl;
    if (input.phone !== undefined) values.phone = input.phone;
    if (input.whatsapp !== undefined) values.whatsapp = input.whatsapp;
    if (input.website !== undefined) values.website = input.website;
    if (input.socialUrl !== undefined) values.socialUrl = input.socialUrl;
    if (input.coverUrl !== undefined) values.coverUrl = input.coverUrl;
    if (input.publishStatus !== undefined) {
      values.publishStatus = input.publishStatus;
      if (input.publishStatus === 'published') values.publishedAt = new Date();
    }
    if (input.operationalStatus !== undefined)
      values.operationalStatus = input.operationalStatus;
    if (input.restricted === null) {
      values.restrictedReason = null;
      values.restrictedAt = null;
    } else if (input.restricted) {
      values.restrictedReason = input.restricted.reason;
      values.restrictedAt = new Date();
    }

    try {
      await this.db
        .update(usahas)
        .set(values)
        .where(and(eq(usahas.id, input.id), isNull(usahas.deletedAt)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('UNIQUE') || msg.includes('unique')) {
        throw new ConflictError('SLUG_TAKEN', 'Slug usaha sudah dipakai');
      }
      throw e;
    }
    return this.findById(input.id);
  }

  async softDelete(id: string): Promise<boolean> {
    const rows = await this.db
      .update(usahas)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(usahas.id, id), isNull(usahas.deletedAt)))
      .returning({ id: usahas.id });
    return rows.length > 0;
  }

  async findById(id: string): Promise<UsahaDetail | null> {
    const [row] = await this.db
      .select(usahaSelect)
      .from(usahas)
      .leftJoin(usahaCategories, eq(usahaCategories.id, usahas.categoryId))
      .leftJoin(regions, eq(regions.id, usahas.villageId))
      .where(and(eq(usahas.id, id), isNull(usahas.deletedAt)))
      .limit(1);
    if (!row) return null;
    const items = await this.itemsOf(row.id);
    return { ...mapUsaha(row), items };
  }

  async findBySlug(
    slug: string,
    opts?: { publicOnly?: boolean },
  ): Promise<UsahaDetail | null> {
    const conds = [eq(usahas.slug, slug), isNull(usahas.deletedAt)];
    if (opts?.publicOnly) conds.push(eq(usahas.publishStatus, 'published'));
    const [row] = await this.db
      .select(usahaSelect)
      .from(usahas)
      .leftJoin(usahaCategories, eq(usahaCategories.id, usahas.categoryId))
      .leftJoin(regions, eq(regions.id, usahas.villageId))
      .where(and(...conds))
      .limit(1);
    if (!row) return null;
    const items = await this.itemsOf(row.id);
    return { ...mapUsaha(row), items };
  }

  async list(input: ListUsahasInput): Promise<ListUsahasResult> {
    const conds = [isNull(usahas.deletedAt)];
    if (input.publicOnly) conds.push(eq(usahas.publishStatus, 'published'));
    else if (input.status) conds.push(eq(usahas.publishStatus, input.status));
    if (input.managerId) conds.push(eq(usahas.managerId, input.managerId));
    if (input.categoryId) conds.push(eq(usahas.categoryId, input.categoryId));
    if (input.kind) conds.push(eq(usahas.kind, input.kind));
    if (input.operationalStatus)
      conds.push(eq(usahas.operationalStatus, input.operationalStatus));
    if (input.regionId) {
      // region_id bisa ULID atau slug - satu subquery, tanpa resolve terpisah.
      const sub = this.db
        .select({ id: regions.id })
        .from(regions)
        .where(or(eq(regions.id, input.regionId), eq(regions.slug, input.regionId)));
      conds.push(inArray(usahas.regionId, sub));
    }
    if (input.villageId) {
      const sub = this.db
        .select({ id: regions.id })
        .from(regions)
        .where(
          or(eq(regions.id, input.villageId), eq(regions.slug, input.villageId)),
        );
      conds.push(inArray(usahas.villageId, sub));
    }
    if (input.q?.trim()) {
      const q = `%${input.q.trim()}%`;
      conds.push(
        or(ilikeCompat(usahas.name, q), ilikeCompat(usahas.slug, q))!,
      );
    }
    if (input.before) conds.push(lt(usahas.id, input.before));

    const rows = await this.db
      .select(usahaSelect)
      .from(usahas)
      .leftJoin(usahaCategories, eq(usahaCategories.id, usahas.categoryId))
      .leftJoin(regions, eq(regions.id, usahas.villageId))
      .where(and(...conds))
      .orderBy(desc(usahas.updatedAt), desc(usahas.id))
      .limit(input.limit + 1);

    const hasMore = rows.length > input.limit;
    const page = hasMore ? rows.slice(0, input.limit) : rows;
    const items = page.map(mapUsaha);
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async itemsOf(usahaId: string): Promise<
    Array<{
      id: string;
      name: string;
      description: string | null;
      priceText: string | null;
      imageUrl: string | null;
      sortOrder: number;
    }>
  > {
    const rows = await this.db
      .select({
        id: usahaItems.id,
        name: usahaItems.name,
        description: usahaItems.description,
        priceText: usahaItems.priceText,
        imageUrl: usahaItems.imageUrl,
        sortOrder: usahaItems.sortOrder,
      })
      .from(usahaItems)
      .where(
        and(eq(usahaItems.usahaId, usahaId), eq(usahaItems.status, 'active')),
      )
      .orderBy(asc(usahaItems.sortOrder), asc(usahaItems.id));
    return rows;
  }

  async insertItem(
    usahaId: string,
    item: {
      name: string;
      description?: string | null;
      priceText?: string | null;
      imageUrl?: string | null;
    },
  ): Promise<string> {
    const id = generateId();
    const [maxRow] = await this.db
      .select({ maxSort: sql<number | null>`max(${usahaItems.sortOrder})` })
      .from(usahaItems)
      .where(eq(usahaItems.usahaId, usahaId));
    await this.db.insert(usahaItems).values({
      id,
      usahaId,
      name: item.name,
      description: item.description ?? null,
      priceText: item.priceText ?? null,
      imageUrl: item.imageUrl ?? null,
      sortOrder: Number(maxRow?.maxSort ?? -1) + 1,
    });
    return id;
  }

  async updateItem(
    itemId: string,
    item: {
      name?: string;
      description?: string | null;
      priceText?: string | null;
      imageUrl?: string | null;
    },
  ): Promise<boolean> {
    const values: Partial<typeof usahaItems.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (item.name !== undefined) values.name = item.name;
    if (item.description !== undefined) values.description = item.description;
    if (item.priceText !== undefined) values.priceText = item.priceText;
    if (item.imageUrl !== undefined) values.imageUrl = item.imageUrl;
    const rows = await this.db
      .update(usahaItems)
      .set(values)
      .where(and(eq(usahaItems.id, itemId), eq(usahaItems.status, 'active')))
      .returning({ id: usahaItems.id });
    return rows.length > 0;
  }

  async softDeleteItem(itemId: string): Promise<boolean> {
    const rows = await this.db
      .update(usahaItems)
      .set({ status: 'deleted', updatedAt: new Date() })
      .where(and(eq(usahaItems.id, itemId), eq(usahaItems.status, 'active')))
      .returning({ id: usahaItems.id });
    return rows.length > 0;
  }

  async categoryRef(categoryId: string): Promise<{
    id: string;
    name: string;
  } | null> {
    const [row] = await this.db
      .select({ id: usahaCategories.id, name: usahaCategories.name })
      .from(usahaCategories)
      .where(
        and(
          eq(usahaCategories.id, categoryId),
          isNull(usahaCategories.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async listCategories(
    publicOnly: boolean,
  ): Promise<Array<{ id: string; name: string }>> {
    const conds = [isNull(usahaCategories.deletedAt)];
    if (publicOnly) conds.push(eq(usahaCategories.status, 'published'));
    const rows = await this.db
      .select({ id: usahaCategories.id, name: usahaCategories.name })
      .from(usahaCategories)
      .where(and(...conds))
      .orderBy(usahaCategories.sortOrder, usahaCategories.name);
    return rows;
  }

  async existingSlugs(slugs: string[]): Promise<Set<string>> {
    if (slugs.length === 0) return new Set();
    const rows = await this.db
      .select({ slug: usahas.slug })
      .from(usahas)
      .where(inArray(usahas.slug, slugs));
    return new Set(rows.map((r) => r.slug));
  }

  async findDuplicates(input: {
    usahaId: string;
    name: string;
    phone?: string | null;
  }): Promise<
    Array<{
      id: string;
      slug: string;
      name: string;
      phone: string | null;
      managerId: string | null;
    }>
  > {
    const conds = [
      isNull(usahas.deletedAt),
      ne(usahas.id, input.usahaId),
      or(
        eq(usahas.name, input.name),
        input.phone ? eq(usahas.phone, input.phone) : undefined,
      )!,
    ];
    const rows = await this.db
      .select({
        id: usahas.id,
        slug: usahas.slug,
        name: usahas.name,
        phone: usahas.phone,
        managerId: usahas.managerId,
      })
      .from(usahas)
      .where(and(...conds))
      .limit(10);
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      phone: r.phone ?? null,
      managerId: r.managerId ?? null,
    }));
  }
}
