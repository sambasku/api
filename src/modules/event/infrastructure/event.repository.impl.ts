import { and, desc, eq, gt, gte, getTableColumns, inArray, isNull, lt, or, asc, sql } from "drizzle-orm";
import type { AppDatabase } from "@/shared/database/drizzle/client";
import { events, eventPlaces } from "@/shared/database/drizzle/schema/events.schema";
import { eventComments, eventCommentRevisions } from "@/shared/database/drizzle/schema/event-comments.schema";
import { eventCategories } from "@/shared/database/drizzle/schema/event-categories.schema";
import { places } from "@/shared/database/drizzle/schema/places.schema";
import { regions } from "@/shared/database/drizzle/schema/regions.schema";
import { users } from "@/shared/database/drizzle/schema/users.schema";
import { ilikeCompat } from "@/shared/database/drizzle/ilike-compat";
import { generateId } from "@/shared/utils/ulid";
import { ConflictError } from "@/shared/errors/app-error";
import { highestUserRoleSql } from "@/shared/database/highest-user-role-sql";
import type {
  Event,
  EventCategoryRef,
  EventComment,
  EventListItem,
  EventPlaceRef,
  EventVillageRef,
} from "../domain/entities/event.entity";
import type {
  CreateEventInput,
  EventCommentListFilter,
  EventRepository,
  ListEventsInput,
  ListEventsResult,
  NewEventCommentInput,
  UpdateEventInput,
} from "../domain/repositories/event.repository";
import { resolvePublicAuthor } from "@/shared/utils/resolve-public-author";
import type { CursorPage } from "@/modules/word/domain/repositories/word.repository";

/** Cap riwayat edit per komentar. */
const COMMENT_REVISION_CAP = 50;

type EventCommentRow = typeof eventComments.$inferSelect;

function toEventComment(
  row: EventCommentRow,
  meta: {
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    userRole: string | null;
    authorDeletedAt: Date | null;
    isEdited: boolean;
  },
): EventComment {
  return {
    id: row.id,
    eventId: row.eventId,
    userId: row.userId,
    username: meta.authorDeletedAt ? null : meta.username,
    displayName: meta.authorDeletedAt ? null : meta.displayName,
    avatarUrl: meta.authorDeletedAt ? null : meta.avatarUrl,
    userRole: meta.authorDeletedAt ? null : meta.userRole,
    authorDeletedAt: meta.authorDeletedAt,
    body: row.body,
    status: row.status,
    isEdited: meta.isEdited,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
  };
}

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
    author: null,
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
    const item = mapEvent(row, byEvent.get(row.id) ?? []);
    item.author = await resolvePublicAuthor(this.db, item.authorId);
    return item;
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
    // Overlap window (kalender bulan): starts < to AND ends >= from.
    const useStartsOrder =
      input.overlapsFrom != null && input.overlapsTo != null;
    if (useStartsOrder) {
      conds.push(lt(events.startsAt, input.overlapsTo!));
      conds.push(gte(events.endsAt, input.overlapsFrom!));
    }
    // Tanpa overlap: urut created_at (entri baru di atas). Dengan overlap:
    // urut starts_at ASC (agenda). Keyset harus cocok dengan kolom sort.
    // Cursor tidak ketemu → halaman kosong (jangan jatuh ke page 1).
    const ascending = input.order === "asc";
    if (input.before) {
      if (useStartsOrder) {
        const [cursor] = await this.db
          .select({ id: events.id, startsAt: events.startsAt })
          .from(events)
          .where(eq(events.id, input.before))
          .limit(1);
        if (!cursor) {
          return { items: [], nextCursor: null };
        }
        conds.push(
          or(
            gt(events.startsAt, cursor.startsAt),
            and(
              eq(events.startsAt, cursor.startsAt),
              lt(events.id, cursor.id),
            ),
          )!,
        );
      } else {
        const [cursor] = await this.db
          .select({ id: events.id, createdAt: events.createdAt })
          .from(events)
          .where(eq(events.id, input.before))
          .limit(1);
        if (!cursor) {
          return { items: [], nextCursor: null };
        }
        conds.push(
          ascending
            ? or(
                gt(events.createdAt, cursor.createdAt),
                and(
                  eq(events.createdAt, cursor.createdAt),
                  lt(events.id, cursor.id),
                ),
              )!
            : or(
                lt(events.createdAt, cursor.createdAt),
                and(
                  eq(events.createdAt, cursor.createdAt),
                  lt(events.id, cursor.id),
                ),
              )!,
        );
      }
    }
    const primaryOrder = useStartsOrder
      ? asc(events.startsAt)
      : ascending
        ? asc(events.createdAt)
        : desc(events.createdAt);
    const rows = await this.db
      .select(eventSelect)
      .from(events)
      .leftJoin(eventCategories, eq(eventCategories.id, events.categoryId))
      .leftJoin(regions, eq(regions.id, events.villageId))
      .where(and(...conds))
      .orderBy(primaryOrder, desc(events.id))
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

  // ---------------------------------------------------------------- komentar

  async createComment(input: NewEventCommentInput): Promise<EventComment> {
    const [row] = await this.db
      .insert(eventComments)
      .values({
        eventId: input.eventId,
        userId: input.userId,
        body: input.body,
        bodyOriginal: input.bodyOriginal,
        createdAt: new Date(),
      })
      .returning();
    if (!row) throw new Error('gagal menyimpan komentar acara');
    const comment = await this.findCommentById(row.id);
    if (!comment) throw new Error('komentar acara tidak ditemukan setelah dibuat');
    return comment;
  }

  async findCommentById(id: string): Promise<EventComment | null> {
    const [row] = await this.db
      .select({
        c: eventComments,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        authorDeletedAt: users.deletedAt,
        userRole: highestUserRoleSql,
        isEdited: sql<boolean>`EXISTS (
          SELECT 1 FROM ${eventCommentRevisions}
          WHERE ${eventCommentRevisions.commentId} = ${eventComments.id}
        )`,
      })
      .from(eventComments)
      .leftJoin(users, eq(users.id, eventComments.userId))
      .where(eq(eventComments.id, id))
      .limit(1);
    if (!row) return null;
    return toEventComment(row.c, {
      username: row.username,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      userRole: row.userRole,
      authorDeletedAt: row.authorDeletedAt,
      isEdited: Boolean(row.isEdited),
    });
  }

  async listComments(
    eventId: string,
    filter: EventCommentListFilter,
  ): Promise<CursorPage<EventComment>> {
    const limit = filter.limit;
    const conditions = [eq(eventComments.eventId, eventId)];
    if (filter.status) conditions.push(eq(eventComments.status, filter.status));
    // Komentar id = ULID monoton -> lt(id, cursor) aman sebagai keyset
    // (satu kolom sort by id desc, bukan composite - lihat rule keyset).
    if (filter.cursor) conditions.push(lt(eventComments.id, filter.cursor));

    const rows = await this.db
      .select({
        c: eventComments,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        authorDeletedAt: users.deletedAt,
        userRole: highestUserRoleSql,
        isEdited: sql<boolean>`EXISTS (
          SELECT 1 FROM ${eventCommentRevisions}
          WHERE ${eventCommentRevisions.commentId} = ${eventComments.id}
        )`,
      })
      .from(eventComments)
      .leftJoin(users, eq(users.id, eventComments.userId))
      .where(and(...conditions))
      .orderBy(desc(eventComments.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: page.map((row) =>
        toEventComment(row.c, {
          username: row.username,
          displayName: row.displayName,
          avatarUrl: row.avatarUrl,
          userRole: row.userRole,
          authorDeletedAt: row.authorDeletedAt,
          isEdited: Boolean(row.isEdited),
        }),
      ),
      nextCursor: hasMore ? (page[page.length - 1]?.c.id ?? null) : null,
      hasMore,
    };
  }

  async updateCommentWithRevision(input: {
    commentId: string;
    editorId: string;
    body: string;
  }): Promise<EventComment | null> {
    const now = new Date();
    const updated = await this.db.transaction(async (tx) => {
      const [current] = await tx
        .select({ body: eventComments.body })
        .from(eventComments)
        .where(eq(eventComments.id, input.commentId))
        .limit(1);
      if (!current) return null;

      await tx.insert(eventCommentRevisions).values({
        commentId: input.commentId,
        editorId: input.editorId,
        body: current.body,
        createdAt: now,
      });
      const excess = await tx
        .select({ id: eventCommentRevisions.id })
        .from(eventCommentRevisions)
        .where(eq(eventCommentRevisions.commentId, input.commentId))
        .orderBy(desc(eventCommentRevisions.createdAt))
        .offset(COMMENT_REVISION_CAP);
      if (excess.length > 0) {
        await tx
          .delete(eventCommentRevisions)
          .where(inArray(eventCommentRevisions.id, excess.map((r) => r.id)));
      }

      const [row] = await tx
        .update(eventComments)
        .set({ body: input.body, updatedAt: now })
        .where(
          and(
            eq(eventComments.id, input.commentId),
            eq(eventComments.status, 'published'),
            eq(eventComments.userId, input.editorId),
          ),
        )
        .returning({ id: eventComments.id });
      return row?.id ?? null;
    });
    if (!updated) return null;
    return this.findCommentById(updated);
  }

  async markCommentDeletedByAuthor(id: string, actorId: string): Promise<boolean> {
    const [row] = await this.db
      .update(eventComments)
      .set({ status: 'deleted_by_author', deletedAt: new Date() })
      .where(
        and(
          eq(eventComments.id, id),
          eq(eventComments.userId, actorId),
          eq(eventComments.status, 'published'),
        ),
      )
      .returning({ id: eventComments.id });
    return Boolean(row);
  }

  async takedownComment(id: string, actorId: string): Promise<boolean> {
    const [row] = await this.db
      .update(eventComments)
      .set({ status: 'taken_down', reviewedBy: actorId, reviewedAt: new Date() })
      .where(and(eq(eventComments.id, id), eq(eventComments.status, 'published')))
      .returning({ id: eventComments.id });
    return Boolean(row);
  }

  async eventTargetExists(id: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.id, id), eq(events.status, 'published'), isNull(events.deletedAt)))
      .limit(1);
    return Boolean(row);
  }
}
