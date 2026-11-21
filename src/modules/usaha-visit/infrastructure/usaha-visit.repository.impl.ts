import { and, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { usahaVisits, usahas, users } from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type {
  ListUsahaVisitsResult,
  UsahaVisitMarkResult,
  UsahaVisitRepository,
  UsahaVisitTarget,
} from '../domain/repositories/usaha-visit.repository';

export class UsahaVisitRepositoryImpl implements UsahaVisitRepository {
  constructor(private readonly db: AppDatabase) {}

  async findPublishedUsaha(usahaId: string): Promise<UsahaVisitTarget | null> {
    const [row] = await this.db
      .select({
        id: usahas.id,
        name: usahas.name,
        slug: usahas.slug,
        publishStatus: usahas.publishStatus,
      })
      .from(usahas)
      .where(
        and(
          eq(usahas.id, usahaId),
          eq(usahas.publishStatus, 'published'),
          isNull(usahas.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async mark(userId: string, usahaId: string): Promise<UsahaVisitMarkResult> {
    await this.db
      .insert(usahaVisits)
      .values({ userId, usahaId })
      .onConflictDoNothing({ target: [usahaVisits.userId, usahaVisits.usahaId] });
    return this.stateFor(userId, usahaId);
  }

  async unmark(userId: string, usahaId: string): Promise<UsahaVisitMarkResult> {
    await this.db
      .delete(usahaVisits)
      .where(
        and(eq(usahaVisits.userId, userId), eq(usahaVisits.usahaId, usahaId)),
      );
    return this.stateFor(userId, usahaId);
  }

  async countByUsahaIds(usahaIds: string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (usahaIds.length === 0) return out;
    const rows = await this.db
      .select({
        usahaId: usahaVisits.usahaId,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(usahaVisits)
      .where(inArray(usahaVisits.usahaId, usahaIds))
      .groupBy(usahaVisits.usahaId);
    for (const r of rows) out.set(r.usahaId, r.count);
    return out;
  }

  async viewerVisitedByUsahaIds(
    userId: string,
    usahaIds: string[],
  ): Promise<Set<string>> {
    const out = new Set<string>();
    if (usahaIds.length === 0) return out;
    const rows = await this.db
      .select({ usahaId: usahaVisits.usahaId })
      .from(usahaVisits)
      .where(
        and(
          eq(usahaVisits.userId, userId),
          inArray(usahaVisits.usahaId, usahaIds),
        ),
      );
    for (const r of rows) out.add(r.usahaId);
    return out;
  }

  async listByUsahaId(
    usahaId: string,
    opts: { limit: number; cursor?: string },
  ): Promise<ListUsahaVisitsResult | null> {
    const usaha = await this.findPublishedUsaha(usahaId);
    if (!usaha) {
      const [any] = await this.db
        .select({ id: usahas.id })
        .from(usahas)
        .where(and(eq(usahas.id, usahaId), isNull(usahas.deletedAt)))
        .limit(1);
      if (!any) return null;
    }

    const conds = [eq(usahaVisits.usahaId, usahaId)];
    if (opts.cursor) {
      const [cursor] = await this.db
        .select({
          id: usahaVisits.id,
          createdAt: usahaVisits.createdAt,
        })
        .from(usahaVisits)
        .where(eq(usahaVisits.id, opts.cursor))
        .limit(1);
      if (!cursor) {
        return { items: [], nextCursor: null, hasMore: false, total: 0 };
      }
      conds.push(
        or(
          lt(usahaVisits.createdAt, cursor.createdAt),
          and(
            eq(usahaVisits.createdAt, cursor.createdAt),
            lt(usahaVisits.id, cursor.id),
          ),
        )!,
      );
    }

    const [totalRow] = await this.db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(usahaVisits)
      .where(eq(usahaVisits.usahaId, usahaId));

    const rows = await this.db
      .select({
        id: usahaVisits.id,
        userId: usahaVisits.userId,
        createdAt: usahaVisits.createdAt,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(usahaVisits)
      .innerJoin(users, eq(users.id, usahaVisits.userId))
      .where(and(...conds))
      .orderBy(desc(usahaVisits.createdAt), desc(usahaVisits.id))
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
    usahaId: string,
  ): Promise<UsahaVisitMarkResult> {
    const counts = await this.countByUsahaIds([usahaId]);
    const visited = await this.viewerVisitedByUsahaIds(userId, [usahaId]);
    return {
      visitCount: counts.get(usahaId) ?? 0,
      viewerVisited: visited.has(usahaId),
    };
  }
}