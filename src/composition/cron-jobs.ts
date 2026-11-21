/** Cron entrypoints dipanggil dari Workers. */

import { db } from "@/shared/database/drizzle/client";
import { WaUsageRepositoryImpl } from "@/modules/wa/infrastructure/wa-message.repository.impl";
import { WA_PROVIDERS } from "@/modules/wa/domain/entities/wa-message.entity";
import { NotificationCampaignRepositoryImpl } from "@/modules/notification-campaign/infrastructure/notification-campaign.repository.impl";
import {
  ProcessCampaignDeliveryUseCase,
  ProcessDueCampaignsUseCase,
} from "@/modules/notification-campaign/application/use-cases/campaign.use-cases";
import * as di from "./container";

const waUsageRepo = new WaUsageRepositoryImpl(db);
const notificationCampaignRepo = new NotificationCampaignRepositoryImpl(db);
const processCampaignDelivery = new ProcessCampaignDeliveryUseCase(
  notificationCampaignRepo,
  di.notificationRepo,
  di.deviceTokenRepo,
  di.pushSender,
);
const processDueCampaigns = new ProcessDueCampaignsUseCase(
  notificationCampaignRepo,
  processCampaignDelivery,
);

/** Dipanggil cron Workers untuk scheduled + lanjutkan chunk sending + reset kuota WA bulanan. */
export async function runDueNotificationCampaigns(): Promise<{
  processed: number;
}> {
  await resetWaUsageIfNewPeriod();
  return processDueCampaigns.execute(5);
}

/**
 * Cron achievement: scan semua katalog aktif (due-check 6 jam via
 * app_settings). Idempotent - tick berulang aman.
 */
export async function runDueAchievementScan(): Promise<{
  scanned: number;
  awarded: number;
  ran: boolean;
}> {
  return di.runDueAchievementScanUseCase.execute();
}

/**
 * Cron leaderboard: finalize minggu due + refresh current.json (interval 6 jam).
 */
export async function runDueLeaderboardJobs(): Promise<{
  refreshed: boolean;
  finalized: boolean;
  finalizedWeekIds: string[];
}> {
  return di.runDueLeaderboardJobsUseCase.execute();
}

export async function runDueStreakReminder(): Promise<{
  ran: boolean;
  sent: number;
  reason?: string;
}> {
  return di.runStreakReminderUseCase.execute();
}

/**
 * Cron Baleho: H-1 ending_soon (1x) lalu timeout bayar / expire live.
 * Idempotent - tick berulang aman.
 */
export async function runDueBalehoRelease(): Promise<{
  cancelled: number;
  expired: number;
  endingSoonNotified: number;
}> {
  const ending = await di.balehoUseCases.notifyEndingSoon();
  const released = await di.balehoUseCases.releaseDue();
  return {
    cancelled: released.cancelled,
    expired: released.expired,
    endingSoonNotified: ending.notified,
  };
}
/**
 * Cron WA: reset used_count tiap awal bulan (tanggal 1, 00:00:01 WIB).
 * Idempoten - lazy reset di WaUsageRepository jadi jaring pengaman.
 */
async function resetWaUsageIfNewPeriod(): Promise<void> {
  try {
    for (const provider of WA_PROVIDERS) {
      await waUsageRepo.getActive(provider);
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "reset kuota wa bulanan gagal",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

