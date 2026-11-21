/** Shared helpers for word-suggestion repository. */
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/shared/database/drizzle/client';
import { users } from '@/shared/database/drizzle/schema';
export async function getUserPublicLabel(userId: string): Promise<UserPublicLabel> {
  const [u] = await db
    .select({ username: users.username, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u) return { username: null, displayName: null };
  const username = u.username ?? null;
  const trimmed = u.displayName?.trim() || null;
  return { username, displayName: trimmed || username };
}

export type UserPublicLabel = { username: string | null; displayName: string | null };

export async function getUserPublicLabels(ids: string[]): Promise<Record<string, UserPublicLabel>> {
  if (ids.length === 0) return {};
  const rows = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName })
    .from(users)
    .where(inArray(users.id, ids));
  const map: Record<string, UserPublicLabel> = {};
  for (const r of rows) {
    const username = r.username ?? null;
    const trimmed = r.displayName?.trim() || null;
    map[r.id] = { username, displayName: trimmed || username };
  }
  return map;
}

