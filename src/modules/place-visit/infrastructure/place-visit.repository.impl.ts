import { and, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { placeVisits, places, users } from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type {
  ListPlaceVisitsResult,
  PlaceVisitMarkResult,
  PlaceVisitRepository,
  PlaceVisitTarget,
} from '../domain/repositories/place-visit.repository';

export class PlaceVisitRepositoryImpl implements PlaceVisitRepository {
  constructor(private readonly db: AppDatabase) {}

  async findPublishedPlace(placeId: string): Promise<PlaceVisitTarget | null> {
    const [row] = await this.db
      .select({
        id: places.id,
        name: places.name,
        slug: places.slug,
        status: places.status,
      })
      .from(places)
      .where(
        and(
          eq(places.id, placeId),
          eq(places.status, 'published'),
          isNull(places.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async mark(userId: string, placeId: string): Promise<PlaceVisitMarkResult> {
    await this.db
      .insert(placeVisits)
      .values({ userId, placeId })
      .onConflictDoNothing({ target: [placeVisits.userId, placeVisits.placeId] });
    return this.stateFor(userId, placeId);
  }

  async unmark(userId: string, placeId: string): Promise<PlaceVisitMarkResult> {
    await this.db
      .delete(placeVisits)
      .where(
        and(eq(placeVisits.userId, userId), eq(placeVisits.placeId, placeId)),
      );
    return this.stateFor(userId, placeId);
  }

  async countByPlaceIds(placeIds: string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (placeIds.length === 0) return out;
    const rows = await this.db
      .select({
        placeId: placeVisits.placeId,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(placeVisits)
      .where(inArray(placeVisits.placeId, placeIds))
      .groupBy(placeVisits.placeId);
    for (const r of rows) out.set(r.placeId, r.count);
    return out;
  }

  async viewerVisitedByPlaceIds(
    userId: string,
    placeIds: string[],
  ): Promise<Set<string>> {
    const out = new Set<string>();
    if (placeIds.length === 0) return out;
    const rows = await this.db
      .select({ placeId: placeVisits.placeId })
      .from(placeVisits)
      .where(
        and(
          eq(placeVisits.userId, userId),
          inArray(placeVisits.placeId, placeIds),
        ),
      );
    for (const r of rows) out.add(r.placeId);
    return out;
  }

  async listByPlaceId(
    placeId: string,
    opts: { limit: number; cursor?: string },
  ): Promise<ListPlaceVisitsResult | null> {
    const place = await this.findPublishedPlace(placeId);
    if (!place) {
      const [any] = await this.db
        .select({ id: places.id })
        .from(places)
        .where(and(eq(places.id, placeId), isNull(places.deletedAt)))
        .limit(1);
      if (!any) return null;
    }

    const conds = [eq(placeVisits.placeId, placeId)];
    if (opts.cursor) {
      const [cursor] = await this.db
        .select({
          id: placeVisits.id,
          createdAt: placeVisits.createdAt,
        })
        .from(placeVisits)
        .where(eq(placeVisits.id, opts.cursor))
        .limit(1);
      if (!cursor) {
        return { items: [], nextCursor: null, hasMore: false, total: 0 };
      }
      conds.push(
        or(
          lt(placeVisits.createdAt, cursor.createdAt),
          and(
            eq(placeVisits.createdAt, cursor.createdAt),
            lt(placeVisits.id, cursor.id),
          ),
        )!,
      );
    }

    const [totalRow] = await this.db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(placeVisits)
      .where(eq(placeVisits.placeId, placeId));

    const rows = await this.db
      .select({
        id: placeVisits.id,
        userId: placeVisits.userId,
        createdAt: placeVisits.createdAt,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(placeVisits)
      .innerJoin(users, eq(users.id, placeVisits.userId))
      .where(and(...conds))
      .orderBy(desc(placeVisits.createdAt), desc(placeVisits.id))
      .limit(opts.limit + 1);

    const hasMore = rows.length > opts.limit;
    const page = hasMore ? rows.slice(0, opts.limit) : rows;
    const last = page[page.length - 1];

    return {
      items: page.map((r) => ({
        id: r.id,
        userId: r.userId,
        username: r.username,
        displayName: r.displayName,
        avatarUrl: r.avatarUrl,
        createdAt: r.createdAt,
      })),
      nextCursor: hasMore && last ? last.id : null,
      hasMore,
      total: totalRow?.count ?? 0,
    };
  }

  private async stateFor(
    userId: string,
    placeId: string,
  ): Promise<PlaceVisitMarkResult> {
    const counts = await this.countByPlaceIds([placeId]);
    const visited = await this.viewerVisitedByPlaceIds(userId, [placeId]);
    return {
      visitCount: counts.get(placeId) ?? 0,
      viewerVisited: visited.has(placeId),
    };
  }
}