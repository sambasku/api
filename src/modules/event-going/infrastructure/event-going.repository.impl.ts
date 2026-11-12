import { and, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import {
  eventGoings,
  events,
  users,
} from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type {
  EventGoingMarkResult,
  EventGoingRepository,
  EventGoingTarget,
  ListEventGoingsResult,
} from '../domain/repositories/event-going.repository';

export class EventGoingRepositoryImpl implements EventGoingRepository {
  constructor(private readonly db: AppDatabase) {}

  async findPublishedEvent(eventId: string): Promise<EventGoingTarget | null> {
    const [row] = await this.db
      .select({
        id: events.id,
        name: events.name,
        slug: events.slug,
        status: events.status,
        cancelledAt: events.cancelledAt,
        startsAt: events.startsAt,
        endsAt: events.endsAt,
      })
      .from(events)
      .where(
        and(
          eq(events.id, eventId),
          eq(events.status, 'published'),
          isNull(events.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async mark(userId: string, eventId: string): Promise<EventGoingMarkResult> {
    await this.db
      .insert(eventGoings)
      .values({ userId, eventId })
      .onConflictDoNothing({ target: [eventGoings.userId, eventGoings.eventId] });
    return this.stateFor(userId, eventId);
  }

  async unmark(userId: string, eventId: string): Promise<EventGoingMarkResult> {
    await this.db
      .delete(eventGoings)
      .where(
        and(eq(eventGoings.userId, userId), eq(eventGoings.eventId, eventId)),
      );
    return this.stateFor(userId, eventId);
  }

  async countByEventIds(eventIds: string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (eventIds.length === 0) return out;
    const rows = await this.db
      .select({
        eventId: eventGoings.eventId,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(eventGoings)
      .where(inArray(eventGoings.eventId, eventIds))
      .groupBy(eventGoings.eventId);
    for (const r of rows) out.set(r.eventId, r.count);
    return out;
  }

  async viewerGoingByEventIds(
    userId: string,
    eventIds: string[],
  ): Promise<Set<string>> {
    const out = new Set<string>();
    if (eventIds.length === 0) return out;
    const rows = await this.db
      .select({ eventId: eventGoings.eventId })
      .from(eventGoings)
      .where(
        and(
          eq(eventGoings.userId, userId),
          inArray(eventGoings.eventId, eventIds),
        ),
      );
    for (const r of rows) out.add(r.eventId);
    return out;
  }

  async listByEventId(
    eventId: string,
    opts: { limit: number; cursor?: string },
  ): Promise<ListEventGoingsResult | null> {
    const event = await this.findPublishedEvent(eventId);
    if (!event) {
      // Admin boleh lihat goings acara draft/archived juga - cek eksistensi saja.
      const [any] = await this.db
        .select({ id: events.id })
        .from(events)
        .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
        .limit(1);
      if (!any) return null;
    }

    const conds = [eq(eventGoings.eventId, eventId)];
    if (opts.cursor) {
      const [cursor] = await this.db
        .select({
          id: eventGoings.id,
          createdAt: eventGoings.createdAt,
        })
        .from(eventGoings)
        .where(eq(eventGoings.id, opts.cursor))
        .limit(1);
      if (!cursor) {
        return { items: [], nextCursor: null, hasMore: false, total: 0 };
      }
      conds.push(
        or(
          lt(eventGoings.createdAt, cursor.createdAt),
          and(
            eq(eventGoings.createdAt, cursor.createdAt),
            lt(eventGoings.id, cursor.id),
          ),
        )!,
      );
    }

    const [totalRow] = await this.db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(eventGoings)
      .where(eq(eventGoings.eventId, eventId));

    const rows = await this.db
      .select({
        id: eventGoings.id,
        userId: eventGoings.userId,
        createdAt: eventGoings.createdAt,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(eventGoings)
      .innerJoin(users, eq(users.id, eventGoings.userId))
      .where(and(...conds))
      .orderBy(desc(eventGoings.createdAt), desc(eventGoings.id))
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
    eventId: string,
  ): Promise<EventGoingMarkResult> {
    const counts = await this.countByEventIds([eventId]);
    const going = await this.viewerGoingByEventIds(userId, [eventId]);
    return {
      goingCount: counts.get(eventId) ?? 0,
      viewerGoing: going.has(eventId),
    };
  }
}
