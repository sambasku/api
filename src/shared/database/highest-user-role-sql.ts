import { sql } from 'drizzle-orm';
import { users } from '@/shared/database/drizzle/schema';

/**
 * Role tertinggi satu user, sebagai kolom di query yang sudah JOIN `users`.
 * Satu subquery di SELECT yang sama, bukan query per baris.
 * Urutan: root > admin > reviewer > editor > lain.
 */
export const highestUserRoleSql = sql<string | null>`(
  SELECT ur.role FROM user_roles ur
  WHERE ur.user_id = ${users.id}
  ORDER BY CASE ur.role
    WHEN 'root' THEN 5
    WHEN 'admin' THEN 4
    WHEN 'reviewer' THEN 3
    WHEN 'editor' THEN 2
    ELSE 1
  END DESC
  LIMIT 1
)`;
