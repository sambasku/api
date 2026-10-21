/**
 * Scan achievement dari CLI (dipakai GitHub Actions manual trigger).
 *
 * Sama persis dengan cron `runDueAchievementScan()` minus due-check 6 jam:
 * scan SEMUA katalog aktif yang punya source komputabel, berikan award
 * ke user yang cocok, kirim notifikasi inbox. Idempoten - award yang sudah
 * ada tidak dobel.
 *
 * Pakai:
 *   pnpm scan:achievements            # semua katalog aktif
 *   pnpm scan:achievements angkatan-ke-1   # hanya 1 kode (bisa diulang)
 *
 * DATABASE_URL harus menunjuk DB target (staging/production).
 */
import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { logger } from '@/shared/logging/logger';

// Import client SETELAH dotenv load (client -> env.ts validasi env).
const { db, closeDb } = await import('../shared/database/drizzle/client');
const { AchievementRepositoryImpl } = await import(
  '../modules/achievement/infrastructure/achievement.repository.impl'
);
const { ScanAchievementUseCase } = await import(
  '../modules/achievement/application/use-cases/scan-achievement.use-case'
);
const { RecordInboxNotificationUseCase } = await import(
  '../modules/notification/application/use-cases/record-inbox-notification.use-case'
);
const { NotificationRepositoryImpl } = await import(
  '../modules/notification/infrastructure/notification.repository.impl'
);
const { AuditLogRepositoryImpl } = await import(
  '../modules/audit/infrastructure/audit-log.repository.impl'
);

/** Maks kandidat per achievement per scan (backfill bertahap). */
const SCAN_BATCH_LIMIT = 1000;

export async function scanAchievements(codes: string[] = []) {
  const repo = new AchievementRepositoryImpl(db);
  const inbox = new RecordInboxNotificationUseCase(new NotificationRepositoryImpl(db));
  const auditRepo = new AuditLogRepositoryImpl(db);
  const scan = new ScanAchievementUseCase(repo, inbox, auditRepo);

  const catalog = await repo.listAdmin({ limit: 100, onlyActive: true });
  let targets = catalog.items.filter((a) => a.criteria.source !== 'manual');
  if (codes.length > 0) {
    targets = targets.filter((a) => codes.includes(a.code));
    if (targets.length === 0) {
      logger.warn(
        `Tidak ada achievement aktif dengan kode: ${codes.join(', ')} (source bukan manual)`,
      );
    }
  }

  let scanned = 0;
  let awarded = 0;
  for (const achievement of targets) {
    const result = await scan.execute({ achievement, limit: SCAN_BATCH_LIMIT });
    scanned += result.scanned;
    awarded += result.awarded;
    logger.info(
      `Scan ${achievement.code}: kandidat ${result.scanned}, award baru ${result.awarded}`,
    );
  }

  logger.info(`Selesai: ${targets.length} katalog, ${scanned} kandidat, ${awarded} award baru`);
  return { targets: targets.length, scanned, awarded };
}

const isDirectRun =
  process.argv[1] != null && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectRun) {
  const codes = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  scanAchievements(codes)
    .then(() => closeDb())
    .then(() => process.exit(0))
    .catch(async (err) => {
      logger.error(err, 'Scan achievement gagal - pastikan database up dan sudah dimigrate');
      await closeDb().catch(() => {});
      process.exit(1);
    });
}
