import type { MentionUserRow } from '../../domain/entities/public-profile.entity';
import type { User } from '@/modules/auth/domain/entities/user.entity';

/**
 * Cari user untuk fitur mention (@username). Khusus endpoint suggest:
 * exact-match per username yang di-extract dari teks komentar/balasan.
 * Hanya user aktif, belum soft-delete. Tanpa email/phone/hash.
 */
export async function findMentionableUsers(
  findByUsername: (username: string) => Promise<User | null>,
  usernames: string[],
): Promise<MentionUserRow[]> {
  const rows: MentionUserRow[] = [];
  for (const username of usernames) {
    const user = await findByUsername(username);
    if (user && user.isActive && !user.deletedAt) {
      rows.push({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      });
    }
  }
  return rows;
}
