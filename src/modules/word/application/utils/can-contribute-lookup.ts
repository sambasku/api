import { eq } from 'drizzle-orm';
import { db } from '@/shared/database/drizzle/client';
import { users } from '@/shared/database/drizzle/schema';
import type { ContributeGateSnapshot } from './assert-can-contribute';

export async function lookupCanContribute(userId: string): Promise<ContributeGateSnapshot | null> {
  const [row] = await db
    .select({
      isActive: users.isActive,
      canContribute: users.canContribute,
      contributeMutedUntil: users.contributeMutedUntil,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row || row.deletedAt) return null;
  return {
    isActive: row.isActive,
    canContribute: row.canContribute,
    contributeMutedUntil: row.contributeMutedUntil ?? null,
  };
}
