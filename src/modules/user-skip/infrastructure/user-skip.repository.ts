import { and, eq } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { userSkips } from '@/shared/database/drizzle/schema';

export type UserSkipTargetType = 'word' | 'contribution' | 'search_miss';

/** Catatan skip per user. POST ulang tidak menambah baris (unik). */
export class UserSkipRepository {
  constructor(private readonly db: AppDatabase) {}

  async record(userId: string, targetType: UserSkipTargetType, targetId: string): Promise<void> {
    await this.db
      .insert(userSkips)
      .values({ userId, targetType, targetId })
      .onConflictDoNothing({
        target: [userSkips.userId, userSkips.targetType, userSkips.targetId],
      });
  }

  async clear(userId: string, targetType: UserSkipTargetType, targetId: string): Promise<void> {
    await this.db
      .delete(userSkips)
      .where(
        and(
          eq(userSkips.userId, userId),
          eq(userSkips.targetType, targetType),
          eq(userSkips.targetId, targetId),
        ),
      );
  }
}
