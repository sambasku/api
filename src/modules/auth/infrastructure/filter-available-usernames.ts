import { and, gt, inArray, isNull, sql } from 'drizzle-orm';
import { usernameChanges, users } from '@/shared/database/drizzle/schema';
import type { AppDatabase, AppTransaction } from '@/shared/database/drizzle/client';

/**
 * Satu batch: buang kandidat yang sudah ada di `users` ATAU masih di-hold
 * di `username_changes` (mobile#257). Dipakai SEBELUM insert-retry.
 * UNIQUE constraint tetap arbiter race (TOCTOU) - jangan andalkan probe saja.
 * Pencocokan case-insensitive memakai `lower(...)`.
 */
export async function filterAvailableUsernames(
  db: AppDatabase | AppTransaction,
  candidates: string[],
): Promise<string[]> {
  const unique = [...new Set(candidates.filter((c) => c.length > 0))];
  if (unique.length === 0) return [];
  const lowers = [...new Set(unique.map((c) => c.toLowerCase()))];

  const now = new Date();
  const [takenRows, heldRows] = await Promise.all([
    db
      .select({ username: users.username })
      .from(users)
      .where(inArray(sql`lower(${users.username})`, lowers)),
    db
      .select({ oldUsername: usernameChanges.oldUsername })
      .from(usernameChanges)
      .where(
        and(
          inArray(sql`lower(${usernameChanges.oldUsername})`, lowers),
          isNull(usernameChanges.releasedAt),
          gt(usernameChanges.holdUntil, now),
        ),
      ),
  ]);

  const taken = new Set([
    ...takenRows.map((r) => r.username.toLowerCase()),
    ...heldRows.map((r) => r.oldUsername.toLowerCase()),
  ]);
  return unique.filter((c) => !taken.has(c.toLowerCase()));
}
