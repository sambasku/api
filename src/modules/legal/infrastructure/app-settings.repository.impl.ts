import { eq, inArray } from 'drizzle-orm';
import { appSettings } from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import {
  DEFAULT_OAUTH_CONSENT_ENFORCEMENT,
  LEGAL_OAUTH_CONSENT_ENFORCEMENT_KEY,
  LEGAL_PRIVACY_VERSION_KEY,
  LEGAL_TERMS_VERSION_KEY,
  type AppSetting,
  type AppSettingType,
  type LegalActiveVersions,
  type OauthConsentEnforcement,
} from '../domain/entities/app-setting.entity';
import type { AppSettingsRepository } from '../domain/repositories/app-settings.repository';

function toEntity(row: typeof appSettings.$inferSelect): AppSetting {
  return {
    key: row.key,
    value: row.value,
    type: row.type as AppSettingType,
    description: row.description,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}

export class AppSettingsRepositoryImpl implements AppSettingsRepository {
  constructor(private readonly db: AppDatabase) {}

  async getAll(): Promise<AppSetting[]> {
    const rows = await this.db.select().from(appSettings);
    return rows.map(toEntity);
  }

  async getByKeys(keys: readonly string[]): Promise<AppSetting[]> {
    if (keys.length === 0) return [];
    const rows = await this.db
      .select()
      .from(appSettings)
      .where(inArray(appSettings.key, [...keys]));
    return rows.map(toEntity);
  }

  async getValue(key: string): Promise<string | null> {
    const [row] = await this.db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, key))
      .limit(1);
    return row?.value ?? null;
  }

  async setIfAbsent(
    key: string,
    value: string,
    options?: { type?: AppSettingType; description?: string; updatedBy?: string | null },
  ): Promise<void> {
    await this.db
      .insert(appSettings)
      .values({
        key,
        value,
        type: options?.type ?? 'string',
        description: options?.description ?? null,
        updatedAt: new Date(),
        updatedBy: options?.updatedBy ?? null,
      })
      .onConflictDoNothing();
  }

  async getLegalActiveVersions(): Promise<LegalActiveVersions | null> {
    const rows = await this.getByKeys([LEGAL_TERMS_VERSION_KEY, LEGAL_PRIVACY_VERSION_KEY]);
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const termsVersion = map[LEGAL_TERMS_VERSION_KEY];
    const privacyVersion = map[LEGAL_PRIVACY_VERSION_KEY];
    if (!termsVersion || !privacyVersion) return null;
    return { termsVersion, privacyVersion };
  }

  async getOauthConsentEnforcement(): Promise<OauthConsentEnforcement> {
    const value = await this.getValue(LEGAL_OAUTH_CONSENT_ENFORCEMENT_KEY);
    return value === 'enforce' ? 'enforce' : DEFAULT_OAUTH_CONSENT_ENFORCEMENT;
  }

  async upsertMany(
    entries: { key: string; value: string; type?: AppSettingType; description?: string }[],
    updatedBy: string | null,
  ): Promise<AppSetting[]> {
    if (entries.length === 0) return [];
    const now = new Date();
    // Satu batch = 1 HTTP roundtrip ke Turso (bukan N subrequest).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const batch = this.db.batch(
      entries.map((entry) =>
        this.db
          .insert(appSettings)
          .values({
            key: entry.key,
            value: entry.value,
            type: entry.type ?? 'string',
            description: entry.description ?? null,
            updatedAt: now,
            updatedBy,
          })
          .onConflictDoUpdate({
            target: appSettings.key,
            set: {
              value: entry.value,
              type: entry.type ?? 'string',
              description: entry.description ?? null,
              updatedAt: now,
              updatedBy,
            },
          })
          .returning(),
      ) as any,
    );
    const results = (await batch) as unknown as Array<typeof appSettings.$inferSelect>;
    return results.map((row) => toEntity(row));
  }
}
