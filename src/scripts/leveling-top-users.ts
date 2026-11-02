/**
 * Soft-check proyeksi level top N user (staging/prod).
 *
 * Pakai:
 *   bun src/scripts/leveling-top-users.ts
 *   bun src/scripts/leveling-top-users.ts 20
 *
 * DATABASE_URL harus menunjuk DB target. Tidak menulis apa pun.
 */
import 'dotenv/config';

const limit = Math.min(100, Math.max(1, Number(process.argv[2] ?? 15) || 15));

const { db, closeDb } = await import('../shared/database/drizzle/client');
const { users } = await import('../shared/database/drizzle/schema');
const { isNull } = await import('drizzle-orm');
const { ANONIM_USER_ID } = await import('../shared/constants/anonim');
const { PublicUserRepositoryImpl } = await import(
  '../modules/user/infrastructure/public-user.repository.impl'
);

const rows = await db
  .select({ id: users.id, username: users.username })
  .from(users)
  .where(isNull(users.deletedAt))
  .limit(500);

const repo = new PublicUserRepositoryImpl(db);
const scored: Array<{
  username: string;
  points: number;
  level: number;
  title: string;
}> = [];

for (const row of rows) {
  if (row.id === ANONIM_USER_ID) continue;
  const stats = await repo.loadStats(row.id);
  if (stats.leveling.points <= 0) continue;
  scored.push({
    username: row.username,
    points: stats.leveling.points,
    level: stats.leveling.level,
    title: stats.leveling.titleCode,
  });
}

scored.sort((a, b) => b.points - a.points || a.username.localeCompare(b.username));
const top = scored.slice(0, limit);

console.log(`Top ${top.length} (dari ${scored.length} user berpoin, sample ${rows.length}):`);
for (const [i, u] of top.entries()) {
  console.log(
    `${String(i + 1).padStart(2)}. L${u.level} ${u.points}pts ${u.title} @${u.username}`,
  );
}

await closeDb();
