import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { closeDb, db } from '@/shared/database/drizzle/client';
import { achievements } from '@/shared/database/drizzle/schema';
import { logger } from '@/shared/logging/logger';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

/**
 * Seed katalog achievement kohort:
 * - angkatan-ke-1 (profile_border): terdaftar sepanjang 2026 WIB.
 * - beta-tester (badge): pengguna fase closed testing 2024 - 12 Oktober 2026.
 *
 * Idempotent: INSERT ... ON CONFLICT(code) DO NOTHING. Award TIDAK
 * diberikan di sini - jalankan Scan di console (atau cron) untuk backfill.
 */
const SEED_ACHIEVEMENTS = [
  {
    code: 'angkatan-ke-1',
    title: 'Angkatan Ke-1',
    description: 'Terdaftar sebagai pengguna SambasKu pada angkatan pertama',
    category: 'kohort',
    rewardType: 'profile_border',
    badgeUrl: 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/achievements/angkatan-ke-1.png',
    criteria: {
      source: 'registration',
      window: { from: '2026-01-01T00:00:00+07:00', to: '2027-01-01T00:00:00+07:00' },
    },
  },
  {
    code: 'beta-tester',
    title: 'Beta Tester',
    description: 'Pengguna awal yang mengikuti fase closed testing',
    category: 'kohort',
    rewardType: 'badge',
    badgeUrl: 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/achievements/beta-tester.png',
    criteria: {
      source: 'registration',
      window: { from: '2024-01-01T00:00:00+07:00', to: '2026-10-13T00:00:00+07:00' },
    },
  },
] as const;

export async function seedAchievements() {
  let inserted = 0;
  for (const item of SEED_ACHIEVEMENTS) {
    const rows = await db
      .insert(achievements)
      .values({ ...item, criteria: JSON.stringify(item.criteria), isActive: true })
      .onConflictDoNothing({ target: achievements.code })
      .returning({ id: achievements.id });
    if (rows.length > 0) inserted += 1;

    // Sinkronisasi aset/kriteria bila baris sudah ada (idempotent re-run):
    // update NON-kritis saja supaya re-run tidak menimpa katalog yang sudah
    // dikurasi admin (title/description/is_active dibiarkan).
    if (rows.length === 0) {
      await db
        .update(achievements)
        .set({
          badgeUrl: item.badgeUrl,
          criteria: JSON.stringify(item.criteria),
          updatedAt: new Date(),
        })
        .where(eq(achievements.code, item.code));
    }
  }
  logger.info(`Seed achievements: ${inserted} baru, total katalog ${SEED_ACHIEVEMENTS.length}`);
}

const isDirectRun =
  process.argv[1] != null && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectRun) {
  seedAchievements()
    .then(() => closeDb())
    .then(() => process.exit(0))
    .catch(async (err) => {
      logger.error(err, 'Seed achievements gagal - pastikan database up dan sudah dimigrate');
      await closeDb().catch(() => {});
      process.exit(1);
    });
}
