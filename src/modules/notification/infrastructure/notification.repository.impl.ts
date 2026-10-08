import { and, count, desc, eq, isNull, lt } from 'drizzle-orm';
import { notifications } from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type {
  InboxNotification,
  InboxNotificationType,
  NotificationActionKind,
  NotificationTargetKind,
} from '../domain/entities/notification.entity';
import type {
  CreateInboxNotificationInput,
  NotificationListOptions,
  NotificationListResult,
  NotificationRepository,
} from '../domain/repositories/notification.repository';

const conflictTarget = [
  notifications.userId,
  notifications.type,
  notifications.targetKind,
  notifications.targetId,
] as const;

function toEntity(row: typeof notifications.$inferSelect): InboxNotification {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type as InboxNotificationType,
    title: row.title,
    body: row.body,
    bodyType: row.bodyType,
    imageUrl: row.imageUrl ?? null,
    targetKind: row.targetKind as NotificationTargetKind,
    targetId: row.targetId,
    actionKind: (row.actionKind as NotificationActionKind | null) ?? null,
    actionValue: row.actionValue ?? null,
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

function rowValues(input: CreateInboxNotificationInput) {
  return {
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    bodyType: input.bodyType ?? 'plain',
    imageUrl: input.imageUrl ?? null,
    targetKind: input.targetKind,
    targetId: input.targetId,
    actionKind: input.actionKind ?? null,
    actionValue: input.actionValue ?? null,
  };
}

export class NotificationRepositoryImpl implements NotificationRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: CreateInboxNotificationInput): Promise<void> {
    await this.db
      .insert(notifications)
      .values(rowValues(input))
      .onConflictDoNothing({ target: [...conflictTarget] });
  }

  async createMany(inputs: CreateInboxNotificationInput[]): Promise<number> {
    if (inputs.length === 0) return 0;
    const inserted = await this.db
      .insert(notifications)
      .values(inputs.map(rowValues))
      .onConflictDoNothing({ target: [...conflictTarget] })
      .returning({ id: notifications.id });
    return inserted.length;
  }

  async upsertUnread(input: CreateInboxNotificationInput): Promise<void> {
    await this.db
      .insert(notifications)
      .values({
        ...rowValues(input),
        readAt: null,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [...conflictTarget],
        set: {
          title: input.title,
          body: input.body,
          bodyType: input.bodyType ?? 'plain',
          imageUrl: input.imageUrl ?? null,
          actionKind: input.actionKind ?? null,
          actionValue: input.actionValue ?? null,
          readAt: null,
          createdAt: new Date(),
        },
      });
  }

  async listByUser(userId: string, opts: NotificationListOptions): Promise<NotificationListResult> {
    const rows = await this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          opts.unreadOnly ? isNull(notifications.readAt) : undefined,
          opts.cursor ? lt(notifications.id, opts.cursor) : undefined,
        ),
      )
      .orderBy(desc(notifications.id))
      .limit(opts.limit + 1);

    const hasMore = rows.length > opts.limit;
    const page = hasMore ? rows.slice(0, opts.limit) : rows;
    return {
      items: page.map(toEntity),
      nextCursor: hasMore ? page[page.length - 1].id : null,
      hasMore,
    };
  }

  async countUnread(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return Number(row?.value ?? 0);
  }

  async markRead(
    userId: string,
    id: string,
  ): Promise<'updated' | 'already_read' | 'not_found'> {
    const [existing] = await this.db
      .select({ id: notifications.id, readAt: notifications.readAt })
      .from(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .limit(1);
    if (!existing) return 'not_found';
    if (existing.readAt) return 'already_read';

    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId), isNull(notifications.readAt)));
    return 'updated';
  }

  async markAllRead(userId: string): Promise<number> {
    const updated = await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
      .returning({ id: notifications.id });
    return updated.length;
  }
}
