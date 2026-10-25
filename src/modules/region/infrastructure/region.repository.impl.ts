import { alias } from 'drizzle-orm/sqlite-core';
import { and, asc, desc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { places } from '@/shared/database/drizzle/schema/places.schema';
import { regions } from '@/shared/database/drizzle/schema/regions.schema';
import { ilikeCompat } from '@/shared/database/drizzle/ilike-compat';
import { ConflictError } from '@/shared/errors/app-error';
import { generateId } from '@/shared/utils/ulid';
import type { Region } from '../domain/entities/region.entity';
import type {
  CreateRegionInput,
  ListRegionsInput,
  ListRegionsResult,
  RegionCatalogItem,
  RegionRepository,
  UpdateRegionInput,
} from '../domain/repositories/region.repository';

type RegionRow = typeof regions.$inferSelect;

function mapRegion(row: RegionRow): Region {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    type: row.type,
    parentId: row.parentId ?? null,
    code: row.code ?? null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    status: row.status,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
  };
}

export class RegionRepositoryImpl implements RegionRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: CreateRegionInput): Promise<Region> {
    try {
      await this.db.insert(regions).values({
        id: generateId(),
        slug: input.slug,
        name: input.name,
        type: input.type,
        parentId: input.parentId ?? null,
        code: input.code ?? null,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        status: input.status ?? 'published',
        sortOrder: input.sortOrder ?? 0,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('UNIQUE') || msg.includes('unique')) {
        throw new ConflictError('REGION_ID_TAKEN', 'Id wilayah sudah dipakai');
      }
      throw e;
    }
    const created = await this.findBySlug(input.slug);
    if (!created) throw new Error('Region create gagal - row tidak ketemu');
    return created;
  }

  async update(input: UpdateRegionInput): Promise<Region | null> {
    const existing = await this.findById(input.id);
    if (!existing) return null;
    const values: Partial<typeof regions.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) values.name = input.name;
    if (input.parentId !== undefined) values.parentId = input.parentId;
    if (input.code !== undefined) values.code = input.code;
    if (input.lat !== undefined) values.lat = input.lat;
    if (input.lng !== undefined) values.lng = input.lng;
    if (input.status !== undefined) values.status = input.status;
    if (input.sortOrder !== undefined) values.sortOrder = input.sortOrder;

    await this.db
      .update(regions)
      .set(values)
      .where(and(eq(regions.id, input.id), isNull(regions.deletedAt)));
    return this.findById(input.id);
  }

  async softDelete(id: string): Promise<boolean> {
    const rows = await this.db
      .update(regions)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(regions.id, id), isNull(regions.deletedAt)))
      .returning({ id: regions.id });
    return rows.length > 0;
  }

  async findById(id: string, opts?: { includeDeleted?: boolean }): Promise<Region | null> {
    const conds = [eq(regions.id, id)];
    if (!opts?.includeDeleted) conds.push(isNull(regions.deletedAt));
    const [row] = await this.db
      .select()
      .from(regions)
      .where(and(...conds))
      .limit(1);
    return row ? mapRegion(row) : null;
  }

  async findBySlug(slug: string): Promise<Region | null> {
    const [row] = await this.db
      .select()
      .from(regions)
      .where(and(eq(regions.slug, slug), isNull(regions.deletedAt)))
      .limit(1);
    return row ? mapRegion(row) : null;
  }

  async findByIdOrSlug(
    ref: string,
    opts?: { includeDeleted?: boolean },
  ): Promise<Region | null> {
    const conds = [or(eq(regions.id, ref), eq(regions.slug, ref))!];
    if (!opts?.includeDeleted) conds.push(isNull(regions.deletedAt));
    const [row] = await this.db
      .select()
      .from(regions)
      .where(and(...conds))
      .limit(1);
    return row ? mapRegion(row) : null;
  }

  async list(input: ListRegionsInput): Promise<ListRegionsResult> {
    const conds = [isNull(regions.deletedAt)];
    if (input.publicOnly) conds.push(eq(regions.status, 'published'));
    else if (input.status) conds.push(eq(regions.status, input.status));
    if (input.type) conds.push(eq(regions.type, input.type));
    if (input.parentId) conds.push(eq(regions.parentId, input.parentId));
    if (input.q?.trim()) {
      const q = `%${input.q.trim()}%`;
      conds.push(or(ilikeCompat(regions.name, q), ilikeCompat(regions.slug, q))!);
    }
    if (input.before) conds.push(lt(regions.id, input.before));

    const rows = await this.db
      .select()
      .from(regions)
      .where(and(...conds))
      .orderBy(desc(regions.id))
      .limit(input.limit + 1);

    const hasMore = rows.length > input.limit;
    const page = hasMore ? rows.slice(0, input.limit) : rows;
    const items = page.map(mapRegion);
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async listPublishedCatalog(): Promise<RegionCatalogItem[]> {
    const parent = alias(regions, 'region_parent');
    const rows = await this.db
      .select({
        slug: regions.slug,
        name: regions.name,
        type: regions.type,
        parentSlug: parent.slug,
        code: regions.code,
        lat: regions.lat,
        lng: regions.lng,
      })
      .from(regions)
      .leftJoin(parent, eq(regions.parentId, parent.id))
      .where(and(isNull(regions.deletedAt), eq(regions.status, 'published')))
      .orderBy(desc(regions.type), asc(regions.name));
    return rows.map((row) => ({
      id: row.slug,
      name: row.name,
      type: row.type,
      parentId: row.parentSlug ?? null,
      code: row.code ?? null,
      lat: row.lat ?? null,
      lng: row.lng ?? null,
    }));
  }

  async countActiveChildren(parentId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)` })
      .from(regions)
      .where(
        and(eq(regions.parentId, parentId), isNull(regions.deletedAt)),
      );
    return Number(row?.n ?? 0);
  }

  async countPlacesUsing(regionId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)` })
      .from(places)
      .where(
        and(
          isNull(places.deletedAt),
          or(eq(places.regionId, regionId), eq(places.villageId, regionId)),
        ),
      );
    return Number(row?.n ?? 0);
  }
}
