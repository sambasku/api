import { and, desc, eq, inArray, isNull, lt } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { auditLogs, cuisines, places, users } from '@/shared/database/drizzle/schema';
import type { ExploreEntityType } from '../domain/entity-change';

/** Aksi audit yang boleh tampil di riwayat publik (selain itu = catatan internal). */
const PUBLIC_ACTIONS = [
  'create',
  'update',
  'publish',
  'unpublish',
  'takedown',
  'photo_add',
  'photo_remove',
];

export interface EntityHistoryRow {
  id: string;
  action: string;
  oldData: unknown;
  newData: unknown;
  createdAt: Date;
  actorUserId: string | null;
  actorUsername: string | null;
  actorDisplayName: string | null;
  sourceContributionId: string | null;
}

export interface ChangeHistoryRepository {
  /** Id entitas published dari slug; null bila tidak ada / tidak tayang. */
  resolvePublishedId(entityType: ExploreEntityType, slug: string): Promise<string | null>;
  listEntityHistory(input: {
    entityType: ExploreEntityType;
    entityId: string;
    limit: number;
    cursor?: string;
  }): Promise<{ items: EntityHistoryRow[]; nextCursor: string | null; hasMore: boolean }>;
}

export class ChangeHistoryRepositoryImpl implements ChangeHistoryRepository {
  constructor(private readonly db: AppDatabase) {}

  async resolvePublishedId(entityType: ExploreEntityType, slug: string): Promise<string | null> {
    if (entityType === 'place') {
      const [row] = await this.db
        .select({ id: places.id })
        .from(places)
        .where(and(eq(places.slug, slug), eq(places.status, 'published'), isNull(places.deletedAt)))
        .limit(1);
      return row?.id ?? null;
    }
    const [row] = await this.db
      .select({ id: cuisines.id })
      .from(cuisines)
      .where(
        and(
          eq(cuisines.slug, slug),
          eq(cuisines.publishStatus, 'published'),
          isNull(cuisines.deletedAt),
        ),
      )
      .limit(1);
    return row?.id ?? null;
  }

  // 1 query: audit_logs LEFT JOIN users (aktor). ULID = urut waktu, cursor = id terakhir.
  async listEntityHistory(input: {
    entityType: ExploreEntityType;
    entityId: string;
    limit: number;
    cursor?: string;
  }) {
    const rows = await this.db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        oldData: auditLogs.oldData,
        newData: auditLogs.newData,
        createdAt: auditLogs.createdAt,
        sourceContributionId: auditLogs.sourceContributionId,
        actorUserId: users.id,
        actorUsername: users.username,
        actorDisplayName: users.displayName,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(
        and(
          eq(auditLogs.entityType, input.entityType),
          eq(auditLogs.entityId, input.entityId),
          inArray(auditLogs.action, PUBLIC_ACTIONS),
          input.cursor ? lt(auditLogs.id, input.cursor) : undefined,
        ),
      )
      .orderBy(desc(auditLogs.id))
      .limit(input.limit + 1);

    const hasMore = rows.length > input.limit;
    const items = hasMore ? rows.slice(0, input.limit) : rows;
    return {
      items: items.map((r) => ({
        ...r,
        actorDisplayName: r.actorDisplayName?.trim() || r.actorUsername || null,
      })),
      nextCursor: hasMore && items.length > 0 ? items[items.length - 1]!.id : null,
      hasMore,
    };
  }
}
