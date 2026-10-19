import { and, desc, eq, inArray, isNull, lt, or } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { placeImages, places } from '@/shared/database/drizzle/schema/places.schema';
import { ilikeCompat } from '@/shared/database/drizzle/ilike-compat';
import { generateId } from '@/shared/utils/ulid';
import { ConflictError } from '@/shared/errors/app-error';
import type {
  Place,
  PlaceImage,
  PlaceImageAttribution,
  PlaceSource,
} from '../domain/entities/place.entity';
import type {
  CreatePlaceInput,
  ListPlacesInput,
  ListPlacesResult,
  PlaceImageInput,
  PlaceRepository,
  UpdatePlaceInput,
} from '../domain/repositories/place.repository';

type PlaceRow = typeof places.$inferSelect;
type ImageRow = typeof placeImages.$inferSelect;

function parseSources(raw: string): PlaceSource[] {
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter(
      (s): s is PlaceSource =>
        !!s &&
        typeof s === 'object' &&
        typeof (s as PlaceSource).name === 'string' &&
        typeof (s as PlaceSource).address === 'string',
    );
  } catch {
    return [];
  }
}

function parseAttribution(raw: string | null): PlaceImageAttribution | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as PlaceImageAttribution;
    if (!v || typeof v.name !== 'string') return null;
    return v;
  } catch {
    return null;
  }
}

function mapImage(row: ImageRow): PlaceImage {
  return {
    id: row.id,
    url: row.url,
    isMain: !!row.isMain,
    sortOrder: row.sortOrder,
    attribution: parseAttribution(row.attributionJson),
  };
}

function mapPlace(row: PlaceRow, images: PlaceImage[]): Place {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    type: row.type ?? null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    mapsUrl: row.mapsUrl ?? null,
    shortDescription: row.shortDescription,
    regionId: row.regionId ?? null,
    hours: row.hours ?? null,
    contact: row.contact ?? null,
    authorId: row.authorId ?? null,
    sources: parseSources(row.sourcesJson),
    images,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
  };
}

function normalizeImages(images: PlaceImageInput[]): PlaceImageInput[] {
  if (images.length === 0) return [];
  let sawMain = false;
  return images.map((img, i) => {
    const wantMain = img.isMain === true && !sawMain;
    if (wantMain) sawMain = true;
    return {
      ...img,
      isMain: wantMain || (!sawMain && i === 0 && images.every((x) => !x.isMain)),
      sortOrder: img.sortOrder ?? i,
    };
  }).map((img, i, arr) => {
    // Pastikan tepat satu main: true pertama menang; tanpa true = index 0.
    if (!arr.some((x) => x.isMain) && i === 0) return { ...img, isMain: true };
    if (img.isMain && arr.findIndex((x) => x.isMain) !== i) return { ...img, isMain: false };
    return img;
  });
}

async function loadImagesForPlaces(
  db: AppDatabase,
  placeIds: string[],
): Promise<Map<string, PlaceImage[]>> {
  const map = new Map<string, PlaceImage[]>();
  if (placeIds.length === 0) return map;
  const rows = await db
    .select()
    .from(placeImages)
    .where(inArray(placeImages.placeId, placeIds))
    .orderBy(placeImages.sortOrder);
  for (const row of rows) {
    const list = map.get(row.placeId) ?? [];
    list.push(mapImage(row));
    map.set(row.placeId, list);
  }
  return map;
}

export class PlaceRepositoryImpl implements PlaceRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: CreatePlaceInput): Promise<Place> {
    const id = input.id ?? generateId();
    const images = normalizeImages(input.images ?? []);
    try {
      await this.db.transaction(async (tx) => {
        await tx.insert(places).values({
          id,
          slug: input.slug,
          name: input.name,
          category: input.category,
          type: input.type ?? null,
          lat: input.lat ?? null,
          lng: input.lng ?? null,
          mapsUrl: input.mapsUrl ?? null,
          shortDescription: input.shortDescription,
          regionId: input.regionId ?? null,
          hours: input.hours ?? null,
          contact: input.contact ?? null,
          authorId: input.authorId ?? null,
          sourcesJson: JSON.stringify(input.sources ?? []),
          status: input.status ?? 'published',
        });
        if (images.length > 0) {
          await tx.insert(placeImages).values(
            images.map((img, i) => ({
              id: generateId(),
              placeId: id,
              url: img.url,
              isMain: !!img.isMain,
              sortOrder: img.sortOrder ?? i,
              attributionJson: img.attribution ? JSON.stringify(img.attribution) : null,
            })),
          );
        }
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('UNIQUE') || msg.includes('unique')) {
        throw new ConflictError('SLUG_TAKEN', 'Slug place sudah dipakai');
      }
      throw e;
    }
    const created = await this.findById(id);
    if (!created) throw new Error('Place create gagal - row tidak ketemu');
    return created;
  }

  async update(input: UpdatePlaceInput): Promise<Place | null> {
    const existing = await this.findById(input.id);
    if (!existing) return null;
    const values: Partial<typeof places.$inferInsert> = { updatedAt: new Date() };
    if (input.slug !== undefined) values.slug = input.slug;
    if (input.name !== undefined) values.name = input.name;
    if (input.category !== undefined) values.category = input.category;
    if (input.type !== undefined) values.type = input.type;
    if (input.lat !== undefined) values.lat = input.lat;
    if (input.lng !== undefined) values.lng = input.lng;
    if (input.mapsUrl !== undefined) values.mapsUrl = input.mapsUrl;
    if (input.shortDescription !== undefined) values.shortDescription = input.shortDescription;
    if (input.regionId !== undefined) values.regionId = input.regionId;
    if (input.hours !== undefined) values.hours = input.hours;
    if (input.contact !== undefined) values.contact = input.contact;
    if (input.authorId !== undefined) values.authorId = input.authorId;
    if (input.sources !== undefined) values.sourcesJson = JSON.stringify(input.sources);
    if (input.status !== undefined) values.status = input.status;

    try {
      await this.db.transaction(async (tx) => {
        await tx
          .update(places)
          .set(values)
          .where(and(eq(places.id, input.id), isNull(places.deletedAt)));
        if (input.images !== undefined) {
          await tx.delete(placeImages).where(eq(placeImages.placeId, input.id));
          const images = normalizeImages(input.images);
          if (images.length > 0) {
            await tx.insert(placeImages).values(
              images.map((img, i) => ({
                id: generateId(),
                placeId: input.id,
                url: img.url,
                isMain: !!img.isMain,
                sortOrder: img.sortOrder ?? i,
                attributionJson: img.attribution ? JSON.stringify(img.attribution) : null,
              })),
            );
          }
        }
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('UNIQUE') || msg.includes('unique')) {
        throw new ConflictError('SLUG_TAKEN', 'Slug place sudah dipakai');
      }
      throw e;
    }
    return this.findById(input.id);
  }

  async softDelete(id: string): Promise<boolean> {
    const rows = await this.db
      .update(places)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(places.id, id), isNull(places.deletedAt)))
      .returning({ id: places.id });
    return rows.length > 0;
  }

  async findById(id: string): Promise<Place | null> {
    const [row] = await this.db
      .select()
      .from(places)
      .where(and(eq(places.id, id), isNull(places.deletedAt)))
      .limit(1);
    if (!row) return null;
    const imgs = await loadImagesForPlaces(this.db, [row.id]);
    return mapPlace(row, imgs.get(row.id) ?? []);
  }

  async findBySlug(
    slug: string,
    opts?: { publicOnly?: boolean },
  ): Promise<Place | null> {
    const conds = [eq(places.slug, slug), isNull(places.deletedAt)];
    if (opts?.publicOnly) conds.push(eq(places.status, 'published'));
    const [row] = await this.db.select().from(places).where(and(...conds)).limit(1);
    if (!row) return null;
    const imgs = await loadImagesForPlaces(this.db, [row.id]);
    return mapPlace(row, imgs.get(row.id) ?? []);
  }

  async findBySlugAny(slug: string): Promise<Place | null> {
    return this.findBySlug(slug, { publicOnly: false });
  }

  async list(input: ListPlacesInput): Promise<ListPlacesResult> {
    const conds = [isNull(places.deletedAt)];
    if (input.publicOnly) conds.push(eq(places.status, 'published'));
    else if (input.status) conds.push(eq(places.status, input.status));
    if (input.category) conds.push(eq(places.category, input.category));
    if (input.regionId) conds.push(eq(places.regionId, input.regionId));
    if (input.q?.trim()) {
      const q = `%${input.q.trim()}%`;
      conds.push(or(ilikeCompat(places.name, q), ilikeCompat(places.slug, q))!);
    }
    if (input.before) conds.push(lt(places.id, input.before));

    const rows = await this.db
      .select()
      .from(places)
      .where(and(...conds))
      .orderBy(desc(places.id))
      .limit(input.limit + 1);

    const hasMore = rows.length > input.limit;
    const page = hasMore ? rows.slice(0, input.limit) : rows;
    const imgs = await loadImagesForPlaces(
      this.db,
      page.map((r) => r.id),
    );
    const items = page.map((r) => mapPlace(r, imgs.get(r.id) ?? []));
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }
}
