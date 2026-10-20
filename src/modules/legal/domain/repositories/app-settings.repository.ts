import type { AppSetting, AppSettingKey, AppSettingType, LegalActiveVersions } from '../entities/app-setting.entity';

export interface AppSettingsRepository {
  getAll(): Promise<AppSetting[]>;
  getByKeys(keys: readonly string[]): Promise<AppSetting[]>;
  getValue(key: string): Promise<string | null>;
  /**
   * Tulis nilai HANYA kalau key belum ada (idempotent, first-writer-wins).
   * Dipakai untuk nilai yang harus stabil per periode (mis. pilihan kata
   * harian) - tidak boleh ditimpa writer lain.
   */
  setIfAbsent(
    key: string,
    value: string,
    options?: { type?: AppSettingType; description?: string; updatedBy?: string | null },
  ): Promise<void>;
  getLegalActiveVersions(): Promise<LegalActiveVersions | null>;
  upsertMany(
    entries: { key: AppSettingKey | string; value: string; type?: AppSettingType; description?: string }[],
    updatedBy: string | null,
  ): Promise<AppSetting[]>;
}
