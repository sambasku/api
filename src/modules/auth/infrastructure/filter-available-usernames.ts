import { inArray } from 'drizzle-orm';
import { users } from '@/shared/database/drizzle/schema';
import type { AppDatabase, AppTransaction } from '@/shared/database/drizzle/client';

/**
 * Satu query batch: buang kandidat username yang sudah ada di `users`.
 * Dipakai SEBELUM insert-retry supaya tidak membuang round-trip insert gagal.
 * UNIQUE constraint tetap arbiter race (TOCTOU) - jangan andalkan probe saja.
 */
export async function filterAvailableUsernames(
  db: AppDatabase | AppTransaction,
  candidates: string[],
): Promise<string[]> {
  const unique = [...new Set(candidates.filter((c) => c.length > 0))];
  if (unique.length === 0) return [];

  const rows = await db
    .select({ username: users.username })
    .from(users)
    .where(inArray(users.username, unique));

  const taken = new Set(rows.map((r) => r.username));
  return unique.filter((c) => !taken.has(c));
}
