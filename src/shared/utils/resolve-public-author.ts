import { and, eq, isNull } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { users } from '@/shared/database/drizzle/schema/users.schema';

/** Ref pengusul publik (JOIN/lookup sekali, hide anonim & akun terhapus). */
export interface PublicAuthorRef {
  id: string;
  username: string;
  displayName: string;
}

/**
 * Resolve `author_id` → profil publik. Satu query. Null bila absen, anonim,
 * soft-delete, atau username kosong.
 */
export async function resolvePublicAuthor(
  db: AppDatabase,
  authorId: string | null | undefined,
): Promise<PublicAuthorRef | null> {
  if (!authorId) return null;
  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
    })
    .from(users)
    .where(and(eq(users.id, authorId), isNull(users.deletedAt)))
    .limit(1);
  if (!row?.username || row.username === 'anonim') return null;
  const display =
    (row.displayName && row.displayName.trim()) || row.username;
  return { id: row.id, username: row.username, displayName: display };
}
