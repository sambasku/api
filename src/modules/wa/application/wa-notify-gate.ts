import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';
import { WA_GROUP_NOTIFY_ENABLED_KEY } from '@/modules/legal/domain/entities/app-setting.entity';
import { logger } from '@/shared/logging/logger';

/**
 * Master switch semua pesan WA keluar (`app_settings.wa_group_notify_enabled`).
 * Fail-closed: baris hilang, nilai selain `true`, atau error query = false.
 * Sengaja tanpa cache: toggle admin harus langsung efektif di Workers.
 */
export async function isWaNotifyEnabled(
  settings: Pick<AppSettingsRepository, 'getValue'>,
): Promise<boolean> {
  try {
    const value = await settings.getValue(WA_GROUP_NOTIFY_ENABLED_KEY);
    return value?.trim().toLowerCase() === 'true';
  } catch (err) {
    logger.warn(
      { error: err instanceof Error ? err.message : String(err) },
      'wa notify gate: gagal baca setting, dianggap nonaktif',
    );
    return false;
  }
}
