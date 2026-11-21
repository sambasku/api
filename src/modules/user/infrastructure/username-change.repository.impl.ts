import { and, desc, eq, gt, inArray, isNull } from 'drizzle-orm';
import { usernameChanges, users } from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { ConflictError, NotFoundError } from '@/shared/errors/app-error';
import { isUniqueViolationOn } from '@/shared/database/drizzle/sqlite-errors';
import { generateId } from '@/shared/utils/ulid';
import {
  USERNAME_HOLD_DAYS,
  addDays,
} from '../application/utils/username-change-policy';
import type {
  ApplyUsernameChangeInput,
  UsernameChangeHistoryItem,
  UsernameChangeRepository,
} from '../domain/repositories/username-change.repository';

export class UsernameChangeRepositoryImpl implements UsernameChangeRepository {
  constructor(private readonly db: AppDatabase) {}

  async findActiveHold(
    username: string,
    now: Date = new Date(),
  ): Promise<{ userId: string; holdUntil: Date } | null> {
    const [row] = await this.db
      .select({
        userId: usernameChanges.userId,
        holdUntil: usernameChanges.holdUntil,
      })
      .from(usernameChanges)
      .where(
        and(
          eq(usernameChanges.oldUsername, username),
          isNull(usernameChanges.releasedAt),
          gt(usernameChanges.holdUntil, now),
        ),
      )
      .limit(1);
    if (!row) return null;
    return { userId: row.userId, holdUntil: row.holdUntil };
  }

  async listHeldUsernames(
    usernames: string[],
    now: Date = new Date(),
  ): Promise<Set<string>> {
    const unique = [...new Set(usernames.filter((u) => u.length > 0))];
    if (unique.length === 0) return new Set();
    const rows = await this.db
      .select({ oldUsername: usernameChanges.oldUsername })
      .from(usernameChanges)
      .where(
        and(
          inArray(usernameChanges.oldUsername, unique),
          isNull(usernameChanges.releasedAt),
          gt(usernameChanges.holdUntil, now),
        ),
      );
    return new Set(rows.map((r) => r.oldUsername));
  }

  async listHistoryForUser(
    userId: string,
    limit = 20,
    now: Date = new Date(),
  ): Promise<UsernameChangeHistoryItem[]> {
    const rows = await this.db
      .select()
      .from(usernameChanges)
      .where(eq(usernameChanges.userId, userId))
      .orderBy(desc(usernameChanges.changedAt))
      .limit(limit);

    return rows.map((row) => {
      const active =
        row.releasedAt === null && row.holdUntil.getTime() > now.getTime();
      return {
        id: row.id,
        userId: row.userId,
        oldUsername: row.oldUsername,
        newUsername: row.newUsername,
        changedAt: row.changedAt,
        holdUntil: row.holdUntil,
        releasedAt: row.releasedAt,
        canReclaim: active,
      };
    });
  }

  async applyUsernameChange(input: ApplyUsernameChangeInput): Promise<void> {
    const now = input.now ?? new Date();
    const holdUntil = addDays(now, USERNAME_HOLD_DAYS);

    await this.db.transaction(async (tx) => {
      // Reclaim: tutup hold aktif atas target.
      await tx
        .update(usernameChanges)
        .set({ releasedAt: now })
        .where(
          and(
            eq(usernameChanges.userId, input.userId),
            eq(usernameChanges.oldUsername, input.newUsername),
            isNull(usernameChanges.releasedAt),
          ),
        );

      try {
        const [updated] = await tx
          .update(users)
          .set({
            username: input.newUsername,
            ...(input.advanceCooldown ? { usernameChangedAt: now } : {}),
            updatedAt: now,
          })
          .where(and(eq(users.id, input.userId), isNull(users.deletedAt)))
          .returning({ id: users.id });
        if (!updated) {
          throw new NotFoundError('USER_NOT_FOUND', `User ${input.userId} tidak ditemukan`);
        }
      } catch (err) {
        if (isUniqueViolationOn(err, 'username')) {
          throw new ConflictError('USERNAME_ALREADY_EXISTS', 'Nama sudah dipakai');
        }
        throw err;
      }

      await tx.insert(usernameChanges).values({
        id: generateId(),
        userId: input.userId,
        oldUsername: input.oldUsername,
        newUsername: input.newUsername,
        changedAt: now,
        holdUntil,
        releasedAt: null,
      });
    });
  }

  async releaseActiveHoldsForUser(
    userId: string,
    now: Date = new Date(),
  ): Promise<void> {
    await this.db
      .update(usernameChanges)
      .set({ releasedAt: now })
      .where(
        and(
          eq(usernameChanges.userId, userId),
          isNull(usernameChanges.releasedAt),
          gt(usernameChanges.holdUntil, now),
        ),
      );
  }
}
