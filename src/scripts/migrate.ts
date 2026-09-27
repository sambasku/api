/**
 * Apply Drizzle migrations via @libsql/client (bukan drizzle-kit CLI).
 *
 * Alasan: drizzle-kit@0.31.x di non-TTY (CI) menyembunyikan error di balik
 * spinner ANSI - exit 1 tanpa pesan (drizzle-orm#6121). Runner ini mencetak
 * stack/cause ke stderr.
 *
 * Usage: pnpm db:migrate
 * Env: DATABASE_URL (wajib), DATABASE_AUTH_TOKEN (wajib untuk libsql:// / https://)
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import {
  slugifyUsername,
  USERNAME_HANDLE_REGEX,
} from '@/modules/auth/application/utils/username-slug';

const url = process.env.DATABASE_URL?.trim() ?? '';
const authToken = process.env.DATABASE_AUTH_TOKEN?.trim() || undefined;
const migrationsFolder = resolve(
  process.cwd(),
  'src/shared/database/drizzle/migrations',
);

/** Harus sama dengan `when` di meta/_journal.json untuk tag 0026_user-last-seen. */
const MIGRATION_0026_WHEN = 1_792_600_000_000;

function fail(message: string, err?: unknown): never {
  console.error(`[db:migrate] ${message}`);
  if (err !== undefined) {
    console.error(err);
    if (err && typeof err === 'object' && 'cause' in err && err.cause) {
      console.error('[db:migrate] cause:', err.cause);
    }
  }
  process.exit(1);
}

function rowField(row: Record<string, unknown> | unknown[], key: string, index: number): unknown {
  if (Array.isArray(row)) return row[index];
  return row[key];
}

/**
 * Staging drift: kolom `last_seen_at` sudah ada (ADD sempat sukses / manual)
 * tapi baris 0026 belum masuk `__drizzle_migrations`. Tanpa repair, drizzle
 * mengulang ADD → SQLITE duplicate column name.
 */
async function repairLastSeenDrift(client: Client): Promise<void> {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash text NOT NULL,
      created_at numeric
    )
  `);

  let hasUsers = false;
  try {
    const tables = await client.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='users'`,
    );
    hasUsers = tables.rows.length > 0;
  } catch {
    return;
  }
  if (!hasUsers) return;

  const info = await client.execute(`PRAGMA table_info(users)`);
  const hasLastSeen = info.rows.some((r) => String(rowField(r as never, 'name', 1)) === 'last_seen_at');
  if (!hasLastSeen) return;

  await client.execute(
    `CREATE INDEX IF NOT EXISTS users_last_seen_at_idx ON users (last_seen_at)`,
  );

  const lastMig = await client.execute(
    `SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1`,
  );
  const lastAt = Number(rowField((lastMig.rows[0] ?? {}) as never, 'created_at', 0) ?? 0);
  if (lastAt >= MIGRATION_0026_WHEN) return;

  const sqlPath = resolve(migrationsFolder, '0026_user-last-seen.sql');
  const query = readFileSync(sqlPath, 'utf8');
  const hash = createHash('sha256').update(query).digest('hex');
  await client.execute({
    sql: `INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)`,
    args: [hash, MIGRATION_0026_WHEN],
  });
  console.log(
    '[db:migrate] repair: 0026_user-last-seen ditandai applied (last_seen_at sudah ada)',
  );
}

/** Idempotent: slugify username yang tidak cocok charset handle @mention (tanpa `-`). */
async function backfillUsernameHandles(client: Client): Promise<void> {
  let rows: Array<Record<string, unknown> | unknown[]>;
  try {
    const result = await client.execute(`SELECT id, username FROM users WHERE username IS NOT NULL`);
    rows = result.rows as Array<Record<string, unknown> | unknown[]>;
  } catch {
    return;
  }

  const taken = new Set<string>();
  for (const row of rows) {
    const u = String(rowField(row, 'username', 1) ?? '');
    if (u) taken.add(u);
  }

  let updated = 0;
  for (const row of rows) {
    const id = String(rowField(row, 'id', 0) ?? '');
    const username = String(rowField(row, 'username', 1) ?? '');
    if (!id || !username || USERNAME_HANDLE_REGEX.test(username)) continue;

    let base = slugifyUsername(username);
    let candidate = base;
    let n = 2;
    while (taken.has(candidate) && candidate !== username) {
      const suffix = `_${n}`;
      candidate = `${base.slice(0, Math.max(1, 30 - suffix.length))}${suffix}`;
      n += 1;
      if (n > 9999) {
        candidate = `user_${id.replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase()}`;
        break;
      }
    }

    if (candidate === username) continue;
    taken.delete(username);
    taken.add(candidate);
    await client.execute({
      sql: `UPDATE users SET username = ? WHERE id = ?`,
      args: [candidate, id],
    });
    updated += 1;
  }

  if (updated > 0) {
    console.log(`[db:migrate] backfill username handle: ${updated} baris diperbarui`);
  }
}

if (!url) {
  fail('DATABASE_URL kosong');
}

const isFile = url.startsWith('file:');
const isRemote = url.startsWith('libsql:') || url.startsWith('https:') || url.startsWith('http:');

if (!isFile && !isRemote) {
  fail(`DATABASE_URL tidak dikenali (harus file: / libsql: / http(s):): ${url.slice(0, 32)}…`);
}

if (isRemote && !authToken) {
  fail('DATABASE_AUTH_TOKEN wajib untuk URL remote Turso');
}

console.log(
  `[db:migrate] url=${isFile ? url : url.replace(/^(libsql|https?):\/\//, '$1://***@')}` +
    ` migrations=${migrationsFolder}`,
);

const client = createClient({
  url,
  authToken: isFile ? undefined : authToken,
});

try {
  await client.execute('select 1');
} catch (err) {
  const status =
    err && typeof err === 'object' && 'cause' in err && err.cause && typeof err.cause === 'object' && 'status' in err.cause
      ? Number((err.cause as { status?: number }).status)
      : undefined;
  if (status === 401) {
    fail(
      'Turso menolak auth (HTTP 401). Buat ulang token: `turso db tokens create <db-name>`, lalu update DATABASE_AUTH_TOKEN / secret GitHub TURSO_STAGING_AUTH_TOKEN',
      err,
    );
  }
  fail('Gagal konek ke database (cek URL/token/jaringan)', err);
}

const db = drizzle(client);

try {
  await repairLastSeenDrift(client);
  await migrate(db, { migrationsFolder });
  await backfillUsernameHandles(client);
  console.log('[db:migrate] OK - migrations applied');
} catch (err) {
  fail('Migrate gagal', err);
} finally {
  client.close();
}
