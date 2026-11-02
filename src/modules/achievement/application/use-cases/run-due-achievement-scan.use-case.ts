import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { AchievementRepository } from '../../domain/repositories/achievement.repository';
import type { ScanAchievementUseCase } from './scan-achievement.use-case';

/** Key app_settings: kapan scan terakhir jalan (ISO 8601). */
export const ACHIEVEMENTS_LAST_SCAN_KEY = 'achievements_last_scan_at';

/** Interval scan: 6 jam. */
export const ACHIEVEMENT_SCAN_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Maks kandidat per achievement per putaran cron (backfill bertahap). */
export const ACHIEVEMENT_SCAN_BATCH_LIMIT = 1000;

export interface RunDueAchievementScanResult {
  scanned: number;
  awarded: number;
  /** true = scan jalan (bukan skip karena belum due). */
  ran: boolean;
}

/**
 * Scan terjadwal: cek due (6 jam), lalu scan semua achievement aktif yang
 * punya source komputabel.
 *
 * Anti-duplikasi: `app_settings.achievements_last_scan_at` - kalau tick
 * cron datang lebih sering dari interval, scan dilewati (hemat subrequest
 * dan tidak membanjiri inbox dengan award berulang).
 */
export class RunDueAchievementScanUseCase {
  constructor(
    private readonly repo: AchievementRepository,
    private readonly scanUseCase: ScanAchievementUseCase,
    private readonly settingsRepo: AppSettingsRepository | null = null,
    private readonly auditRepo?: AuditLogRepository,
  ) {}

  async execute(now: Date = new Date()): Promise<RunDueAchievementScanResult> {
    if (this.settingsRepo) {
      const lastRaw = await this.settingsRepo.getValue(ACHIEVEMENTS_LAST_SCAN_KEY);
      if (lastRaw) {
        const last = new Date(lastRaw);
        if (!Number.isNaN(last.getTime()) && now.getTime() - last.getTime() < ACHIEVEMENT_SCAN_INTERVAL_MS) {
          return { scanned: 0, awarded: 0, ran: false };
        }
      }
    }

    // Semua aktif, tanpa hard-cap page 50 (ACHIEVEMENT_ENHANCEMENT Q2).
    const catalog = await this.repo.listActiveForScan();
    // Kandidat untuk semua katalog aktif di SATU roundtrip (db.batch),
    // lalu award + notifikasi juga batch. Total subrequest per putaran
    // tetap kecil walau katalog bertambah (aturan join-bukan-n-panggilan).
    const scannable = catalog.filter(
      (a) => !a.criteria.source || a.criteria.source !== 'manual',
    );
    let scanned = 0;
    let awarded = 0;
    if (scannable.length > 0) {
      const candidatesByAchievement = await this.repo.findUnawardedCandidatesBatch(
        scannable.map((a) => ({ id: a.id, criteria: a.criteria })),
        ACHIEVEMENT_SCAN_BATCH_LIMIT,
      );
      for (const achievement of scannable) {
        const candidates = candidatesByAchievement.get(achievement.id) ?? [];
        scanned += candidates.length;
        const result = await this.scanUseCase.execute({
          achievement,
          candidates,
        });
        awarded += result.awarded;
      }
    }

    if (this.settingsRepo) {
      await this.settingsRepo.upsertMany(
        [
          {
            key: ACHIEVEMENTS_LAST_SCAN_KEY,
            value: now.toISOString(),
            type: 'string',
            description: 'Waktu scan achievement terakhir (cron)',
          },
        ],
        null,
      );
    }

    await this.auditRepo?.record({
      userId: null,
      action: 'scan_all',
      entityType: 'achievement',
      entityId: 'scheduled',
      newData: { scanned, awarded },
    });

    return { scanned, awarded, ran: true };
  }
}
