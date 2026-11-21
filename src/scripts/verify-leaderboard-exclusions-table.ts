/**
 * Cek post-migrate: tabel exclude leaderboard ada (0183).
 * Usage: DATABASE_URL=... DATABASE_AUTH_TOKEN=... pnpm exec tsx src/scripts/verify-leaderboard-exclusions-table.ts
 */
import 'dotenv/config';
import { createClient } from '@libsql/client';

const url = process.env.DATABASE_URL?.trim() ?? '';
const authToken = process.env.DATABASE_AUTH_TOKEN?.trim() || undefined;

if (!url) {
  console.error('[verify-leaderboard-exclusions] DATABASE_URL kosong');
  process.exit(1);
}

const client = createClient({ url, authToken });
try {
  const r = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='leaderboard_excluded_users' LIMIT 1",
  );
  if (r.rows.length === 0) {
    console.error(
      '[verify-leaderboard-exclusions] Tabel leaderboard_excluded_users belum ada. Pastikan checkout berisi migrasi 0183 dan db:migrate sukses.',
    );
    process.exit(1);
  }
  console.log('[verify-leaderboard-exclusions] OK: leaderboard_excluded_users ada');
} finally {
  client.close();
}