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
 * Default: upsert menimpa password jadi pass1234.
 * SEED_ACCOUNTS_INSERT_ONLY=1: insert saja, skip jika username sudah ada.
 */
const SEED_USERS = [
  { username: 'admin', email: 'admin@sambasku.com', roles: ['admin'] },
  { username: 'root', email: 'root@sambasku.com', roles: ['root'] },
  { username: 'contributor', email: 'contributor@sambasku.com', roles: ['contributor'] },
  { username: 'reviewer', email: 'reviewer@sambasku.com', roles: ['reviewer'] },
] as const;

const SEED_PASSWORD = 'pass1234';

/** Seed akun default. Default upsert by username; insert-only jika SEED_ACCOUNTS_INSERT_ONLY=1. */
export async function seedAccounts(): Promise<void> {
  const insertOnly = process.env.SEED_ACCOUNTS_INSERT_ONLY === '1';
  const hasher = new Pbkdf2PasswordService();
  const passwordHash = await hasher.hash(SEED_PASSWORD);

  for (const user of SEED_USERS) {
    const { roles, ...values } = { ...user, passwordHash, emailVerified: true, displayName: user.username };

    if (insertOnly) {
      const result = await db
        .insert(users)
        .values(values)
        .onConflictDoNothing({ target: users.username })
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

    const [row] = await db
      .insert(users)
      .values(values)
      .onConflictDoUpdate({
        target: users.username,
        set: {
          email: user.email,
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
