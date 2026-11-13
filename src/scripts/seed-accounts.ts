import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { closeDb, db } from '@/shared/database/drizzle/client';
import { users, userRoles } from '@/shared/database/drizzle/schema';
import { Pbkdf2PasswordService } from '@/modules/auth/infrastructure/pbkdf2-password.service';
import { logger } from '@/shared/logging/logger';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

/**
 * Akun login default - domain @sambasku.com (lihat api-base-stack.md).
 * Login by email. Username harus lolos guard handle 6-30 (migration 0122):
 * `admin`/`root` kependekan → `admin_user`/`root_user` (selaras backfill migrate).
 * Default: upsert by email menimpa password (DEFAULT_SEED_PASSWORD untuk lokal).
 * SEED_ACCOUNTS_PASSWORD: override (wajib di production via GitHub secret).
 * SEED_ACCOUNTS_INSERT_ONLY=1: insert saja, skip jika email sudah ada.
 */
const SEED_USERS = [
  { username: 'admin_user', email: 'admin@sambasku.com', roles: ['admin'] },
  { username: 'root_user', email: 'root@sambasku.com', roles: ['root'] },
  { username: 'contributor', email: 'contributor@sambasku.com', roles: ['contributor'] },
  { username: 'reviewer', email: 'reviewer@sambasku.com', roles: ['reviewer'] },
] as const;

/** Fallback lokal saja. Production/staging CI harus set SEED_ACCOUNTS_PASSWORD. */
const DEFAULT_SEED_PASSWORD = 'pass1234';

/** Seed akun default. Default upsert by email; insert-only jika SEED_ACCOUNTS_INSERT_ONLY=1. */
export async function seedAccounts(): Promise<void> {
  const insertOnly = process.env.SEED_ACCOUNTS_INSERT_ONLY === '1';
  const seedPassword = process.env.SEED_ACCOUNTS_PASSWORD?.trim() || DEFAULT_SEED_PASSWORD;
  const hasher = new Pbkdf2PasswordService();
  const passwordHash = await hasher.hash(seedPassword);

  for (const user of SEED_USERS) {
    const { roles, ...values } = {
      ...user,
      passwordHash,
      emailVerified: true,
      displayName: user.username,
    };

    if (insertOnly) {
      const result = await db
        .insert(users)
        .values(values)
        .onConflictDoNothing({ target: users.email })
        .returning({ id: users.id });
      const inserted = result.length > 0;
      if (inserted) {
        await db
          .insert(userRoles)
          .values(roles.map((role) => ({ userId: result[0]!.id, role })))
          .onConflictDoNothing();
        logger.info(`Seeded user ${user.email} (roles: ${roles.join(', ')})`);
      } else {
        logger.info(`Skipped existing user ${user.email}`);
      }
      continue;
    }

    // Upsert by email (stabil). Set username juga supaya baris legacy
    // `admin`/`root` (pre-0122) ikut rename tanpa kena trigger abort.
    const [row] = await db
      .insert(users)
      .values(values)
      .onConflictDoUpdate({
        target: users.email,
        set: {
          username: user.username,
          passwordHash,
          emailVerified: true,
          updatedAt: new Date(),
        },
      })
      .returning({ id: users.id });
    await db.delete(userRoles).where(eq(userRoles.userId, row!.id));
    await db
      .insert(userRoles)
      .values(roles.map((role) => ({ userId: row!.id, role })))
      .onConflictDoNothing();
    logger.info(`Seeded user ${user.email} (roles: ${roles.join(', ')})`);
  }
}

const isDirectRun =
  process.argv[1] != null && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectRun) {
  seedAccounts()
    .then(() => closeDb())
    .then(() => process.exit(0))
    .catch(async (err) => {
      logger.error(err, 'Seed accounts gagal - pastikan database up dan sudah dimigrate');
      await closeDb().catch(() => {});
      process.exit(1);
    });
}
