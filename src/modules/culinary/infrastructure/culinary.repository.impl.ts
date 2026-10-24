import { and, asc, desc, eq, getTableColumns, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { cuisines } from '@/shared/database/drizzle/schema/cuisines.schema';
import { culinaryCategories } from '@/shared/database/drizzle/schema/culinary-categories.schema';
import { culinaryPlaces } from '@/shared/database/drizzle/schema/culinary-places.schema';
import { culinaryPlaceCuisines } from '@/shared/database/drizzle/schema/culinary-place-cuisines.schema';
import { ilikeCompat } from '@/shared/database/drizzle/ilike-compat';
import { generateId } from '@/shared/utils/ulid';
import { ConflictError } from '@/shared/errors/app-error';
import {
  mapImages,
  mapSources,
  parseJsonArray,
  type Cuisine,
  type CuisineDetail,
  type CuisinePlaceLink,
  type CulinaryPlace,
  type CulinaryPlaceDetail,
} from '../domain/entities/culinary.entity';
import type {
  CreateCuisineInput,
  CreateLinkInput,
  CreatePlaceInput,
  CulinaryRepository,
  ListCuisinesInput,
  ListPlacesInput,
  ListResult,
  UpdateCuisineInput,
  UpdateLinkInput,
  UpdatePlaceInput,
} from '../domain/repositories/culinary.repository';

type CuisineRow = typeof cuisines.$inferSelect;
type PlaceRow = typeof culinaryPlaces.$inferSelect;

const cuisineSelect = {
  ...getTableColumns(cuisines),
  categoryName: culinaryCategories.name,
};

const placeSelect = { ...getTableColumns(culinaryPlaces) };

function mapCuisine(row: CuisineRow & { categoryName: string | null }): Cuisine {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? null,
    categoryId: row.categoryId ?? null,
    category:
      row.categoryId && row.categoryName
        ? { id: row.categoryId, name: row.categoryName }
        : null,
    originRegion: row.originRegion ?? null,
    images: mapImages(row.imagesJson),
    ingredients: parseJsonArray<string>(row.ingredientsJson),
    servingSuggestion: row.servingSuggestion ?? null,
    tags: parseJsonArray<string>(row.tagsJson),
    sources: mapSources(row.sourcesJson),
    license: row.license ?? null,
    publishStatus: row.publishStatus,
    restrictedReason: row.restrictedReason ?? null,
    restrictedAt: row.restrictedAt ?? null,
    authorId: row.authorId ?? null,
    publishedAt: row.publishedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
  };
}

function mapPlace(row: PlaceRow): CulinaryPlace {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    type: row.type ?? null,
    description: row.description ?? null,
    locationHint: row.locationHint ?? null,
    addressText: row.addressText ?? null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    mapsUrl: row.mapsUrl ?? null,
    phone: row.phone ?? null,
    whatsapp: row.whatsapp ?? null,
    website: row.website ?? null,
    socialUrl: row.socialUrl ?? null,
    coverUrl: row.coverUrl ?? null,
    operationalStatus: row.operationalStatus,
    publishStatus: row.publishStatus,
    restrictedReason: row.restrictedReason ?? null,
    restrictedAt: row.restrictedAt ?? null,
    managerId: row.managerId ?? null,
    authorId: row.authorId ?? null,
    publishedAt: row.publishedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
  };
}

type LinkRow = typeof culinaryPlaceCuisines.$inferSelect;

function mapLink(
  row: LinkRow,
  cuisineName: string | null,
  cuisineSlug: string | null,
  placeName: string | null,
  placeSlug: string | null,
): CuisinePlaceLink {
  return {
    id: row.id,
    cuisineId: row.cuisineId,
    placeId: row.placeId,
    availability: row.availability,
    note: row.note ?? null,
    publishStatus: row.publishStatus,
    cuisineName,
    cuisineSlug,
    placeName,
    placeSlug,
  };
}

const isUniqueError = (e: unknown): boolean => {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes('UNIQUE') || msg.includes('unique');
};

export class CulinaryRepositoryImpl implements CulinaryRepository {
  constructor(private readonly db: AppDatabase) {}

  // ------------------------------------------------------------- kuliner --

  async createCuisine(input: CreateCuisineInput): Promise<Cuisine> {
    const id = input.id ?? generateId();
    const now = new Date();
    try {
      await this.db.insert(cuisines).values({
        id,
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        categoryId: input.categoryId ?? null,
        originRegion: input.originRegion ?? null,
        imagesJson: input.imagesJson ?? null,
        ingredientsJson: input.ingredientsJson ?? null,
        servingSuggestion: input.servingSuggestion ?? null,
        tagsJson: input.tagsJson ?? null,
        sourcesJson: input.sourcesJson ?? null,
        license: input.license ?? null,
        publishStatus: input.publishStatus ?? 'published',
        publishedAt:
          input.publishStatus === undefined || input.publishStatus === 'published'
            ? now
            : null,
        authorId: input.authorId ?? null,
      });
    } catch (e) {
      if (isUniqueError(e)) {
        throw new ConflictError('SLUG_TAKEN', 'Slug kuliner sudah dipakai');
      }
      throw e;
    }
    const created = await this.findCuisineById(id);
    if (!created) throw new Error('Kuliner create gagal - row tidak ketemu');
    return created;
  }

  async updateCuisine(input: UpdateCuisineInput): Promise<Cuisine | null> {
    const values: Partial<typeof cuisines.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.slug !== undefined) values.slug = input.slug;
    if (input.name !== undefined) values.name = input.name;
    if (input.description !== undefined) values.description = input.description;
    if (input.categoryId !== undefined) values.categoryId = input.categoryId;
    if (input.originRegion !== undefined) values.originRegion = input.originRegion;
    if (input.imagesJson !== undefined) values.imagesJson = input.imagesJson;
    if (input.ingredientsJson !== undefined)
      values.ingredientsJson = input.ingredientsJson;
    if (input.servingSuggestion !== undefined)
      values.servingSuggestion = input.servingSuggestion;
    if (input.tagsJson !== undefined) values.tagsJson = input.tagsJson;
    if (input.sourcesJson !== undefined) values.sourcesJson = input.sourcesJson;
    if (input.license !== undefined) values.license = input.license;
    if (input.publishStatus !== undefined) {
      values.publishStatus = input.publishStatus;
      if (input.publishStatus === 'published') values.publishedAt = new Date();
    }
    if (input.restricted === null) {
      values.restrictedReason = null;
      values.restrictedAt = null;
    } else if (input.restricted) {
      values.restrictedReason = input.restricted.reason;
      values.restrictedAt = new Date();
    }
    try {
      await this.db
        .update(cuisines)
        .set(values)
        .where(and(eq(cuisines.id, input.id), isNull(cuisines.deletedAt)));
    } catch (e) {
      if (isUniqueError(e)) {
        throw new ConflictError('SLUG_TAKEN', 'Slug kuliner sudah dipakai');
      }
      throw e;
    }
    return this.findCuisineById(input.id);
  }

  async softDeleteCuisine(id: string): Promise<boolean> {
    const rows = await this.db
      .update(cuisines)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(cuisines.id, id), isNull(cuisines.deletedAt)))
      .returning({ id: cuisines.id });
    return rows.length > 0;
  }

  async findCuisineById(id: string): Promise<CuisineDetail | null> {
    const [row] = await this.db
      .select(cuisineSelect)
      .from(cuisines)
      .leftJoin(culinaryCategories, eq(culinaryCategories.id, cuisines.categoryId))
      .where(and(eq(cuisines.id, id), isNull(cuisines.deletedAt)))
      .limit(1);
    if (!row) return null;
    return { ...mapCuisine(row), places: await this.linksForCuisine(row.id) };
  }

  async findCuisineBySlug(
    slug: string,
    opts?: { publicOnly?: boolean },
  ): Promise<CuisineDetail | null> {
    const conds = [eq(cuisines.slug, slug), isNull(cuisines.deletedAt)];
    if (opts?.publicOnly) conds.push(eq(cuisines.publishStatus, 'published'));
    const [row] = await this.db
      .select(cuisineSelect)
      .from(cuisines)
      .leftJoin(culinaryCategories, eq(culinaryCategories.id, cuisines.categoryId))
      .where(and(...conds))
      .limit(1);
    if (!row) return null;
    return { ...mapCuisine(row), places: await this.linksForCuisine(row.id) };
  }

  async listCuisines(input: ListCuisinesInput): Promise<ListResult<Cuisine>> {
    const conds = [isNull(cuisines.deletedAt)];
    if (input.publicOnly) conds.push(eq(cuisines.publishStatus, 'published'));
    else if (input.status) conds.push(eq(cuisines.publishStatus, input.status));
    if (input.categoryId) conds.push(eq(cuisines.categoryId, input.categoryId));
    if (input.q?.trim()) {
      const q = `%${input.q.trim()}%`;
      conds.push(or(ilikeCompat(cuisines.name, q), ilikeCompat(cuisines.slug, q))!);
    }
    if (input.before) conds.push(lt(cuisines.id, input.before));
    const rows = await this.db
      .select(cuisineSelect)
      .from(cuisines)
      .leftJoin(culinaryCategories, eq(culinaryCategories.id, cuisines.categoryId))
      .where(and(...conds))
      .orderBy(desc(cuisines.updatedAt), desc(cuisines.id))
      .limit(input.limit + 1);
    const hasMore = rows.length > input.limit;
    const page = hasMore ? rows.slice(0, input.limit) : rows;
    const items = page.map(mapCuisine);
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async existingCuisineSlugs(slugs: string[]): Promise<Set<string>> {
    if (slugs.length === 0) return new Set();
    const rows = await this.db
      .select({ slug: cuisines.slug })
      .from(cuisines)
      .where(inArray(cuisines.slug, slugs));
    return new Set(rows.map((r) => r.slug));
  }

  async findCuisineDuplicates(input: {
    q: string;
    excludeId?: string;
  }): Promise<Array<{ id: string; slug: string; name: string }>> {
    const term = input.q.trim().toLowerCase();
    if (!term) return [];
    const conds = [
      isNull(cuisines.deletedAt),
      ne(cuisines.publishStatus, 'archived'),
      sql`lower(trim(${cuisines.name})) like ${`%${term}%`}`,
    ];
    if (input.excludeId) conds.push(ne(cuisines.id, input.excludeId));
    const rows = await this.db
      .select({ id: cuisines.id, slug: cuisines.slug, name: cuisines.name })
      .from(cuisines)
      .where(and(...conds))
      .limit(10);
    return rows;
  }

  // --------------------------------------------------- tempat/penjual --

  async createPlace(input: CreatePlaceInput): Promise<CulinaryPlace> {
    const id = input.id ?? generateId();
    const now = new Date();
    try {
      await this.db.insert(culinaryPlaces).values({
        id,
        slug: input.slug,
        name: input.name,
        type: input.type ?? null,
        description: input.description ?? null,
        locationHint: input.locationHint ?? null,
        addressText: input.addressText ?? null,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        mapsUrl: input.mapsUrl ?? null,
        phone: input.phone ?? null,
        whatsapp: input.whatsapp ?? null,
        website: input.website ?? null,
        socialUrl: input.socialUrl ?? null,
        coverUrl: input.coverUrl ?? null,
        operationalStatus: input.operationalStatus ?? 'unknown',
        publishStatus: input.publishStatus ?? 'published',
        publishedAt:
          input.publishStatus === undefined || input.publishStatus === 'published'
            ? now
            : null,
        authorId: input.authorId ?? null,
      });
    } catch (e) {
      if (isUniqueError(e)) {
        throw new ConflictError('SLUG_TAKEN', 'Slug tempat sudah dipakai');
      }
      throw e;
    }
    const created = await this.findPlaceById(id);
    if (!created) throw new Error('Tempat create gagal - row tidak ketemu');
    return created;
  }

  async updatePlace(input: UpdatePlaceInput): Promise<CulinaryPlace | null> {
    const values: Partial<typeof culinaryPlaces.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.slug !== undefined) values.slug = input.slug;
    if (input.name !== undefined) values.name = input.name;
    if (input.type !== undefined) values.type = input.type;
    if (input.description !== undefined) values.description = input.description;
    if (input.locationHint !== undefined) values.locationHint = input.locationHint;
    if (input.addressText !== undefined) values.addressText = input.addressText;
    if (input.lat !== undefined) values.lat = input.lat;
    if (input.lng !== undefined) values.lng = input.lng;
    if (input.mapsUrl !== undefined) values.mapsUrl = input.mapsUrl;
    if (input.phone !== undefined) values.phone = input.phone;
    if (input.whatsapp !== undefined) values.whatsapp = input.whatsapp;
    if (input.website !== undefined) values.website = input.website;
    if (input.socialUrl !== undefined) values.socialUrl = input.socialUrl;
    if (input.coverUrl !== undefined) values.coverUrl = input.coverUrl;
    if (input.operationalStatus !== undefined)
      values.operationalStatus = input.operationalStatus;
    if (input.publishStatus !== undefined) {
      values.publishStatus = input.publishStatus;
      if (input.publishStatus === 'published') values.publishedAt = new Date();
    }
    if (input.restricted === null) {
      values.restrictedReason = null;
      values.restrictedAt = null;
    } else if (input.restricted) {
      values.restrictedReason = input.restricted.reason;
      values.restrictedAt = new Date();
    }
    try {
      await this.db
        .update(culinaryPlaces)
        .set(values)
        .where(
          and(eq(culinaryPlaces.id, input.id), isNull(culinaryPlaces.deletedAt)),
        );
    } catch (e) {
      if (isUniqueError(e)) {
        throw new ConflictError('SLUG_TAKEN', 'Slug tempat sudah dipakai');
      }
      throw e;
    }
    return this.findPlaceById(input.id);
  }

  async softDeletePlace(id: string): Promise<boolean> {
    const rows = await this.db
      .update(culinaryPlaces)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(culinaryPlaces.id, id), isNull(culinaryPlaces.deletedAt)))
      .returning({ id: culinaryPlaces.id });
    return rows.length > 0;
  }

  async findPlaceById(id: string): Promise<CulinaryPlaceDetail | null> {
    const [row] = await this.db
      .select(placeSelect)
      .from(culinaryPlaces)
      .where(and(eq(culinaryPlaces.id, id), isNull(culinaryPlaces.deletedAt)))
      .limit(1);
    if (!row) return null;
    return { ...mapPlace(row), cuisines: await this.linksForPlace(row.id) };
  }

  async findPlaceBySlug(
    slug: string,
    opts?: { publicOnly?: boolean },
  ): Promise<CulinaryPlaceDetail | null> {
    const conds = [eq(culinaryPlaces.slug, slug), isNull(culinaryPlaces.deletedAt)];
    if (opts?.publicOnly)
      conds.push(eq(culinaryPlaces.publishStatus, 'published'));
    const [row] = await this.db
      .select(placeSelect)
      .from(culinaryPlaces)
      .where(and(...conds))
      .limit(1);
    if (!row) return null;
    return { ...mapPlace(row), cuisines: await this.linksForPlace(row.id) };
  }

  async listPlaces(input: ListPlacesInput): Promise<ListResult<CulinaryPlace>> {
    const conds = [isNull(culinaryPlaces.deletedAt)];
    if (input.publicOnly)
      conds.push(eq(culinaryPlaces.publishStatus, 'published'));
    else if (input.status)
      conds.push(eq(culinaryPlaces.publishStatus, input.status));
    if (input.managerId) conds.push(eq(culinaryPlaces.managerId, input.managerId));
    if (input.type) conds.push(eq(culinaryPlaces.type, input.type));
    if (input.operationalStatus)
      conds.push(eq(culinaryPlaces.operationalStatus, input.operationalStatus));
    if (input.q?.trim()) {
      const q = `%${input.q.trim()}%`;
      conds.push(
        or(ilikeCompat(culinaryPlaces.name, q), ilikeCompat(culinaryPlaces.slug, q))!,
      );
    }
    if (input.before) conds.push(lt(culinaryPlaces.id, input.before));
    const rows = await this.db
      .select(placeSelect)
      .from(culinaryPlaces)
      .where(and(...conds))
      .orderBy(desc(culinaryPlaces.updatedAt), desc(culinaryPlaces.id))
      .limit(input.limit + 1);
    const hasMore = rows.length > input.limit;
    const page = hasMore ? rows.slice(0, input.limit) : rows;
    const items = page.map(mapPlace);
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async existingPlaceSlugs(slugs: string[]): Promise<Set<string>> {
    if (slugs.length === 0) return new Set();
    const rows = await this.db
      .select({ slug: culinaryPlaces.slug })
      .from(culinaryPlaces)
      .where(inArray(culinaryPlaces.slug, slugs));
    return new Set(rows.map((r) => r.slug));
  }

  async findPlaceDuplicates(input: {
    q: string;
    excludeId?: string;
  }): Promise<Array<{ id: string; slug: string; name: string }>> {
    const term = input.q.trim().toLowerCase();
    if (!term) return [];
    const conds = [
      isNull(culinaryPlaces.deletedAt),
      ne(culinaryPlaces.publishStatus, 'archived'),
      sql`lower(trim(${culinaryPlaces.name})) like ${`%${term}%`}`,
    ];
    if (input.excludeId) conds.push(ne(culinaryPlaces.id, input.excludeId));
    const rows = await this.db
      .select({
        id: culinaryPlaces.id,
        slug: culinaryPlaces.slug,
        name: culinaryPlaces.name,
      })
      .from(culinaryPlaces)
      .where(and(...conds))
      .limit(10);
    return rows;
  }

  // ------------------------------------------------------------- relasi --

  async createLink(input: CreateLinkInput): Promise<CuisinePlaceLink> {
    const id = input.id ?? generateId();
    try {
      await this.db.insert(culinaryPlaceCuisines).values({
        id,
        cuisineId: input.cuisineId,
        placeId: input.placeId,
        availability: input.availability ?? 'unknown',
        note: input.note ?? null,
        publishStatus: input.publishStatus ?? 'published',
        authorId: input.authorId ?? null,
      });
    } catch (e) {
      if (isUniqueError(e)) {
        throw new ConflictError(
          'LINK_EXISTS',
          'Hubungan kuliner dan tempat ini sudah ada',
        );
      }
      throw e;
    }
    const created = await this.findLinkById(id);
    if (!created) throw new Error('Relasi create gagal - row tidak ketemu');
    return created;
  }

  async updateLink(input: UpdateLinkInput): Promise<CuisinePlaceLink | null> {
    const values: Partial<typeof culinaryPlaceCuisines.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.availability !== undefined) values.availability = input.availability;
    if (input.note !== undefined) values.note = input.note;
    if (input.publishStatus !== undefined)
      values.publishStatus = input.publishStatus;
    await this.db
      .update(culinaryPlaceCuisines)
      .set(values)
      .where(
        and(
          eq(culinaryPlaceCuisines.id, input.id),
          isNull(culinaryPlaceCuisines.deletedAt),
        ),
      );
    return this.findLinkById(input.id);
  }

  async softDeleteLink(id: string): Promise<boolean> {
    const rows = await this.db
      .update(culinaryPlaceCuisines)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(culinaryPlaceCuisines.id, id),
          isNull(culinaryPlaceCuisines.deletedAt),
        ),
      )
      .returning({ id: culinaryPlaceCuisines.id });
    return rows.length > 0;
  }

  async findLinkById(id: string): Promise<CuisinePlaceLink | null> {
    const [row] = await this.db
      .select({
        link: culinaryPlaceCuisines,
        cuisineName: cuisines.name,
        cuisineSlug: cuisines.slug,
        placeName: culinaryPlaces.name,
        placeSlug: culinaryPlaces.slug,
      })
      .from(culinaryPlaceCuisines)
      .leftJoin(cuisines, eq(cuisines.id, culinaryPlaceCuisines.cuisineId))
      .leftJoin(culinaryPlaces, eq(culinaryPlaces.id, culinaryPlaceCuisines.placeId))
      .where(eq(culinaryPlaceCuisines.id, id))
      .limit(1);
    if (!row) return null;
    return mapLink(
      row.link,
      row.cuisineName ?? null,
      row.cuisineSlug ?? null,
      row.placeName ?? null,
      row.placeSlug ?? null,
    );
  }

  async findLinkByPair(
    cuisineId: string,
    placeId: string,
  ): Promise<CuisinePlaceLink | null> {
    const [row] = await this.db
      .select({
        link: culinaryPlaceCuisines,
        cuisineName: cuisines.name,
        cuisineSlug: cuisines.slug,
        placeName: culinaryPlaces.name,
        placeSlug: culinaryPlaces.slug,
      })
      .from(culinaryPlaceCuisines)
      .leftJoin(cuisines, eq(cuisines.id, culinaryPlaceCuisines.cuisineId))
      .leftJoin(culinaryPlaces, eq(culinaryPlaces.id, culinaryPlaceCuisines.placeId))
      .where(
        and(
          eq(culinaryPlaceCuisines.cuisineId, cuisineId),
          eq(culinaryPlaceCuisines.placeId, placeId),
          isNull(culinaryPlaceCuisines.deletedAt),
        ),
      )
      .limit(1);
    if (!row) return null;
    return mapLink(
      row.link,
      row.cuisineName ?? null,
      row.cuisineSlug ?? null,
      row.placeName ?? null,
      row.placeSlug ?? null,
    );
  }

  async linksForCuisine(cuisineId: string): Promise<CuisinePlaceLink[]> {
    const rows = await this.db
      .select({
        link: culinaryPlaceCuisines,
        placeName: culinaryPlaces.name,
        placeSlug: culinaryPlaces.slug,
      })
      .from(culinaryPlaceCuisines)
      // INNER JOIN: relasi hanya tayang bila tempatnya juga published.
      .innerJoin(culinaryPlaces, eq(culinaryPlaces.id, culinaryPlaceCuisines.placeId))
      .where(
        and(
          eq(culinaryPlaceCuisines.cuisineId, cuisineId),
          eq(culinaryPlaceCuisines.publishStatus, 'published'),
          isNull(culinaryPlaceCuisines.deletedAt),
          eq(culinaryPlaces.publishStatus, 'published'),
          isNull(culinaryPlaces.deletedAt),
        ),
      )
      .orderBy(asc(culinaryPlaces.name))
      .limit(100);
    return rows.map((r) =>
      mapLink(r.link, null, null, r.placeName ?? null, r.placeSlug ?? null),
    );
  }

  async linksForPlace(placeId: string): Promise<CuisinePlaceLink[]> {
    const rows = await this.db
      .select({
        link: culinaryPlaceCuisines,
        cuisineName: cuisines.name,
        cuisineSlug: cuisines.slug,
      })
      .from(culinaryPlaceCuisines)
      .innerJoin(cuisines, eq(cuisines.id, culinaryPlaceCuisines.cuisineId))
      .where(
        and(
          eq(culinaryPlaceCuisines.placeId, placeId),
          eq(culinaryPlaceCuisines.publishStatus, 'published'),
          isNull(culinaryPlaceCuisines.deletedAt),
          eq(cuisines.publishStatus, 'published'),
          isNull(cuisines.deletedAt),
        ),
      )
      .orderBy(asc(cuisines.name))
      .limit(100);
    return rows.map((r) =>
      mapLink(r.link, r.cuisineName ?? null, r.cuisineSlug ?? null, null, null),
    );
  }

  // ---------------------------------------------------------- kategori --

  async categoryRef(categoryId: string) {
    const [row] = await this.db
      .select({ id: culinaryCategories.id, name: culinaryCategories.name })
      .from(culinaryCategories)
      .where(
        and(
          eq(culinaryCategories.id, categoryId),
          isNull(culinaryCategories.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async listCategories(publicOnly: boolean) {
    const conds = [isNull(culinaryCategories.deletedAt)];
    if (publicOnly) conds.push(eq(culinaryCategories.status, 'published'));
    return this.db
      .select({ id: culinaryCategories.id, name: culinaryCategories.name })
      .from(culinaryCategories)
      .where(and(...conds))
      .orderBy(culinaryCategories.sortOrder, culinaryCategories.name);
  }
}
