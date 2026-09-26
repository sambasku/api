import { and, eq } from 'drizzle-orm';
import { notificationPushCooldowns } from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type {
  NotificationPushCooldown,
  NotificationPushCooldownRepository,
  ReviewPushCooldownChannel,
} from '../domain/repositories/notification-push-cooldown.repository';

export class NotificationPushCooldownRepositoryImpl implements NotificationPushCooldownRepository {
  constructor(private readonly db: AppDatabase) {}

  async get(
    userId: string,
    channel: ReviewPushCooldownChannel,
  ): Promise<NotificationPushCooldown | null> {
    const [row] = await this.db
      .select()
      .from(notificationPushCooldowns)
      .where(
        and(
          eq(notificationPushCooldowns.userId, userId),
          eq(notificationPushCooldowns.channel, channel),
        ),
      )
      .limit(1);
    if (!row) return null;
    return {
      userId: row.userId,
      channel: row.channel as ReviewPushCooldownChannel,
      lastPushAt: row.lastPushAt,
    };
  }

  async touch(userId: string, channel: ReviewPushCooldownChannel, at: Date = new Date()): Promise<void> {
    await this.db
      .insert(notificationPushCooldowns)
      .values({
        userId,
        channel,
        lastPushAt: at,
      })
      .onConflictDoUpdate({
        target: [notificationPushCooldowns.userId, notificationPushCooldowns.channel],
        set: { lastPushAt: at },
      });
  }
}
