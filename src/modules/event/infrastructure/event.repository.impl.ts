import { and, desc, eq, gte, getTableColumns, inArray, isNull, lt, or, asc } from "drizzle-orm";
import type { AppDatabase } from "@/shared/database/drizzle/client";
import { events, eventPlaces } from "@/shared/database/drizzle/schema/events.schema";
import { eventCategories } from "@/shared/database/drizzle/schema/event-categories.schema";
import { places } from "@/shared/database/drizzle/schema/places.schema";
import { regions } from "@/shared/database/drizzle/schema/regions.schema";
import { ilikeCompat } from "@/shared/database/drizzle/ilike-compat";
import { generateId } from "@/shared/utils/ulid";
import { ConflictError } from "@/shared/errors/app-error";
import type {
  Event,
  EventCategoryRef,
  EventListItem,
  EventPlaceRef,
  EventVillageRef,
} from "../domain/entities/event.entity";
import type {
  CreateEventInput,
  EventRepository,
  ListEventsInput,
  ListEventsResult,
  UpdateEventInput,
} from "../domain/repositories/event.repository";

type EventRow = typeof events.$inferSelect;

/**
 * Baris event + JOIN kategori & desa (LEFT JOIN, satu query). Kategori dan
 * desa ikut di-select supaya read-path tetap 2 query (rule subrequest).
 */
type EventJoinedRow = EventRow & {
  categoryName: string | null;
  villageName: string | null;
  villageSlug: string | null;
};

const eventSelect = {
  ...getTableColumns(events),
  categoryName: eventCategories.name,
  villageName: regions.name,
  villageSlug: regions.slug,
};

function mapEvent(
  row: EventJoinedRow,
  placeRefs: EventPlaceRef[],
): EventListItem {
  const base: Event = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    categoryId: row.categoryId,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    locationText: row.locationText,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    mapsUrl: row.mapsUrl ?? null,
    posterUrls: Array.isArray(row.posterUrls) ? row.posterUrls : [],
    organizer: row.organizer ?? null,
    sourceUrl: row.sourceUrl ?? null,
    sourceType: row.sourceType ?? null,
    sourceAttribution: row.sourceAttribution ?? null,
    regionId: row.regionId ?? null,
    villageId: row.villageId ?? null,
    status: row.status,
    cancelledAt: row.cancelledAt ?? null,
    publishedAt: row.publishedAt ?? null,
    authorId: row.authorId ?? null,
    places: placeRefs,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
  };
  return {
    ...base,
    category: row.categoryName
      ? { id: row.categoryId, name: row.categoryName }
      : null,
    village:
      row.villageId && row.villageName
        ? { id: row.villageId, name: row.villageName, slug: row.villageSlug ?? null }
        : null,
  };
}

/**
 * Muat relasi tempat wisata untuk kumpulan event dalam 1 query batch (IN),
 * lalu gabung synchronous - patuhi budget subrequest (rule join-bukan-n-panggilan).
 */
async function loadPlaces(
  db: AppDatabase,
  eventIds: string[],
): Promise<Map<string, EventPlaceRef[]>> {
  const byEvent = new Map<string, EventPlaceRef[]>();
  if (eventIds.length === 0) return byEvent;
  const rows = await db
    .select({
      eventId: eventPlaces.eventId,
      id: places.id,
      slug: places.slug,
      name: places.name,
      category: places.category,
    })
    .from(eventPlaces)
    .innerJoin(places, eq(places.id, eventPlaces.placeId))
    .where(inArray(eventPlaces.eventId, eventIds));
  for (const row of rows) {
    const list = byEvent.get(row.eventId) ?? [];
    list.push({
      id: row.id,
      slug: row.slug,
      name: row.name,
      category: row.category ?? null,
    });
    byEvent.set(row.eventId, list);
  }
  return byEvent;
}

export class EventRepositoryImpl implements EventRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: CreateEventInput): Promise<EventListItem> {
    const id = input.id ?? generateId();
    const now = new Date();
    try {
      await this.db.transaction(async (tx) => {
        await tx.insert(events).values({
          id,
          slug: input.slug,
          name: input.name,
          description: input.description,
          categoryId: input.categoryId,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          locationText: input.locationText,
          lat: input.lat ?? null,
          lng: input.lng ?? null,
          mapsUrl: input.mapsUrl ?? null,
          posterUrls: input.posterUrls ?? [],
          organizer: input.organizer ?? null,
          sourceUrl: input.sourceUrl ?? null,
          sourceType: input.sourceType ?? null,
          sourceAttribution: input.sourceAttribution ?? null,
          regionId: input.regionId ?? null,
          villageId: input.villageId ?? null,
          status: input.status ?? "published",
          publishedAt:
            input.status === undefined || input.status === "published"
              ? now
              : null,
          authorId: input.authorId ?? null,
        });
        if (input.placeIds?.length) {
          await tx.insert(eventPlaces).values(
            input.placeIds.map((placeId) => ({ eventId: id, placeId })),
          );
        }
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("UNIQUE") || msg.includes("unique")) {
        throw new ConflictError("SLUG_TAKEN", "Slug event sudah dipakai");
      }
      throw e;
    }
    const created = await this.findById(id);
    if (!created) throw new Error("Event create gagal - row tidak ketemu");
    return created;
  }

  async update(input: UpdateEventInput): Promise<EventListItem | null> {
    const values: Partial<typeof events.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.slug !== undefined) values.slug = input.slug;
    if (input.name !== undefined) values.name = input.name;
    if (input.description !== undefined) values.description = input.description;
    if (input.categoryId !== undefined) values.categoryId = input.categoryId;
    if (input.startsAt !== undefined) values.startsAt = input.startsAt;
    if (input.endsAt !== undefined) values.endsAt = input.endsAt;
    if (input.locationText !== undefined) values.locationText = input.locationText;
    if (input.lat !== undefined) values.lat = input.lat;
    if (input.lng !== undefined) values.lng = input.lng;
    if (input.mapsUrl !== undefined) values.mapsUrl = input.mapsUrl;
    if (input.posterUrls !== undefined) values.posterUrls = input.posterUrls;
    if (input.organizer !== undefined) values.organizer = input.organizer;
    if (input.sourceUrl !== undefined) values.sourceUrl = input.sourceUrl;
    if (input.sourceType !== undefined) values.sourceType = input.sourceType;
    if (input.sourceAttribution !== undefined)
      values.sourceAttribution = input.sourceAttribution;
    if (input.regionId !== undefined) values.regionId = input.regionId;
    if (input.villageId !== undefined) values.villageId = input.villageId;
    if (input.status !== undefined) {
      values.status = input.status;
      if (input.status === "published") values.publishedAt = new Date();
    }
    if (input.cancelled === true) values.cancelledAt = new Date();
    else if (input.cancelled === false) values.cancelledAt = null;

    try {
      await this.db.transaction(async (tx) => {
        await tx
          .update(events)
          .set(values)
          .where(and(eq(events.id, input.id), isNull(events.deletedAt)));
        if (input.placeIds !== undefined) {
          await tx.delete(eventPlaces).where(eq(eventPlaces.eventId, input.id));
          if (input.placeIds.length > 0) {
            await tx.insert(eventPlaces).values(
              input.placeIds.map((placeId) => ({
                eventId: input.id,
                placeId,
              })),
            );
          }
        }
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("UNIQUE") || msg.includes("unique")) {
        throw new ConflictError("SLUG_TAKEN", "Slug event sudah dipakai");
      }
      throw e;
    }
    return this.findById(input.id);
  }

  async softDelete(id: string): Promise<boolean> {
    const rows = await this.db
      .update(events)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(events.id, id), isNull(events.deletedAt)))
      .returning({ id: events.id });
    return rows.length > 0;
  }

  async findById(id: string): Promise<EventListItem | null> {
    const [row] = await this.db
      .select(eventSelect)
      .from(events)
      .leftJoin(eventCategories, eq(eventCategories.id, events.categoryId))
      .leftJoin(regions, eq(regions.id, events.villageId))
      .where(and(eq(events.id, id), isNull(events.deletedAt)))
      .limit(1);
    if (!row) return null;
    const byEvent = await loadPlaces(this.db, [row.id]);
    return mapEvent(row, byEvent.get(row.id) ?? []);
  }

  async findBySlug(
    slug: string,
    opts?: { publicOnly?: boolean },
  ): Promise<EventListItem | null> {
    const conds = [eq(events.slug, slug), isNull(events.deletedAt)];
    if (opts?.publicOnly) conds.push(eq(events.status, "published"));
    const [row] = await this.db
      .select(eventSelect)
      .from(events)
      .leftJoin(eventCategories, eq(eventCategories.id, events.categoryId))
      .leftJoin(regions, eq(regions.id, events.villageId))
      .where(and(...conds))
      .limit(1);
    if (!row) return null;
    const byEvent = await loadPlaces(this.db, [row.id]);
    return mapEvent(row, byEvent.get(row.id) ?? []);
  }

  async list(input: ListEventsInput): Promise<ListEventsResult> {
    const conds = [isNull(events.deletedAt)];
    if (input.publicOnly) conds.push(eq(events.status, "published"));
    else if (input.status) conds.push(eq(events.status, input.status));
    if (input.categoryId) conds.push(eq(events.categoryId, input.categoryId));
    if (input.villageId) {
      // `village_id` bisa ULID (isi FK) atau slug wilayah ("pemangkat/perapakan")
      // sesuai katalog publik regions. Dua-duanya dicocokkan dalam SATU subquery
      // supaya budget subrequest tetap (tidak resolve slug -> id terpisah).
      const sub = this.db
        .select({ id: regions.id })
        .from(regions)
        .where(
          or(
            eq(regions.id, input.villageId),
            eq(regions.slug, input.villageId),
          ),
        );
      conds.push(inArray(events.villageId, sub));
    }
    if (input.regionId) {
      // `region_id` (kecamatan) bisa ULID atau slug. Acara bisa tercatat via
      // region_id langsung ATAU hanya village_id desa - dua-duanya dicocokkan
      // lewat subquery bersarang, tetap SATU statement (budget subrequest).
      const kecSub = this.db
        .select({ id: regions.id })
        .from(regions)
        .where(
          or(eq(regions.id, input.regionId), eq(regions.slug, input.regionId)),
        );
      const desaSub = this.db
        .select({ id: regions.id })
        .from(regions)
        .where(inArray(regions.parentId, kecSub));
      conds.push(
        or(inArray(events.regionId, kecSub), inArray(events.villageId, desaSub))!,
      );
    }
    if (input.q?.trim()) {
      const q = `%${input.q.trim()}%`;
      conds.push(or(ilikeCompat(events.name, q), ilikeCompat(events.slug, q))!);
    }
    if (input.notEnded) conds.push(gte(events.endsAt, new Date()));
    if (input.placeId) {
      // Subquery EXISTS - satu query, tanpa N+1.
      const sub = this.db
        .select({ eventId: eventPlaces.eventId })
        .from(eventPlaces)
        .where(eq(eventPlaces.placeId, input.placeId));
      conds.push(inArray(events.id, sub));
    }
    if (input.before) conds.push(lt(events.id, input.before));

    const order =
      input.order === "asc" ? asc(events.startsAt) : desc(events.startsAt);
    const rows = await this.db
      .select(eventSelect)
      .from(events)
      .leftJoin(eventCategories, eq(eventCategories.id, events.categoryId))
      .leftJoin(regions, eq(regions.id, events.villageId))
      .where(and(...conds))
      .orderBy(order, desc(events.id))
      .limit(input.limit + 1);

    const hasMore = rows.length > input.limit;
    const page = hasMore ? rows.slice(0, input.limit) : rows;
    const byEvent = await loadPlaces(
      this.db,
      page.map((r) => r.id),
    );
    const items = page.map((r) => mapEvent(r, byEvent.get(r.id) ?? []));
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async setPlaces(eventId: string, placeIds: string[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(eventPlaces).where(eq(eventPlaces.eventId, eventId));
      if (placeIds.length > 0) {
        await tx.insert(eventPlaces).values(
          placeIds.map((placeId) => ({ eventId, placeId })),
        );
      }
    });
  }

  async placesOf(eventId: string): Promise<EventPlaceRef[]> {
    const rows = await this.db
      .select({
        id: places.id,
        slug: places.slug,
        name: places.name,
        category: places.category,
      })
      .from(eventPlaces)
      .innerJoin(places, eq(places.id, eventPlaces.placeId))
      .where(eq(eventPlaces.eventId, eventId));
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      category: r.category ?? null,
    }));
  }

  async categoryRef(categoryId: string): Promise<EventCategoryRef | null> {
    const [row] = await this.db
      .select({ id: eventCategories.id, name: eventCategories.name })
      .from(eventCategories)
      .where(eq(eventCategories.id, categoryId))
      .limit(1);
    return row ?? null;
  }

  async villageRef(villageId: string): Promise<EventVillageRef | null> {
    const [row] = await this.db
      .select({ id: regions.id, name: regions.name, slug: regions.slug })
      .from(regions)
      .where(eq(regions.id, villageId))
      .limit(1);
    return row ? { id: row.id, name: row.name, slug: row.slug ?? null } : null;
  }

  async listCategories(publicOnly: boolean): Promise<EventCategoryRef[]> {
    const conds = [isNull(eventCategories.deletedAt)];
    if (publicOnly) conds.push(eq(eventCategories.status, "published"));
    const rows = await this.db
      .select({ id: eventCategories.id, name: eventCategories.name })
      .from(eventCategories)
      .where(and(...conds))
      .orderBy(eventCategories.sortOrder, eventCategories.name);
    return rows.map((r) => ({ id: r.id, name: r.name }));
  }

  async validPlaceIds(placeIds: string[]): Promise<Set<string>> {
    if (placeIds.length === 0) return new Set();
    const rows = await this.db
      .select({ id: places.id })
      .from(places)
      .where(
        and(
          inArray(places.id, placeIds),
          eq(places.status, "published"),
          isNull(places.deletedAt),
        ),
      );
    return new Set(rows.map((r) => r.id));
  }

  async existingSlugs(slugs: string[]): Promise<Set<string>> {
    if (slugs.length === 0) return new Set();
    const rows = await this.db
      .select({ slug: events.slug })
      .from(events)
      .where(inArray(events.slug, slugs));
    return new Set(rows.map((r) => r.slug));
  }
}
