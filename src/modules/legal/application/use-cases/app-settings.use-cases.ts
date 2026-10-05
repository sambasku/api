import { BadRequestError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import {
  APP_SETTING_KEYS,
  type AppSettingKey,
  WA_GROUP_CTA_URL_KEY,
  WA_VERIFIER_ENABLED_KEY,
} from '../../domain/entities/app-setting.entity';
import type { AppSettingsRepository } from '../../domain/repositories/app-settings.repository';

const ALLOWED = new Set<string>(APP_SETTING_KEYS);

export class GetAppSettingsUseCase {
  constructor(private readonly settingsRepo: AppSettingsRepository) {}

  async execute() {
    const rows = await this.settingsRepo.getByKeys(APP_SETTING_KEYS);
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return APP_SETTING_KEYS.map((key) => ({
      key,
      value: map[key] ?? null,
      updated_at: rows.find((r) => r.key === key)?.updatedAt?.toISOString() ?? null,
      updated_by: rows.find((r) => r.key === key)?.updatedBy ?? null,
    }));
  }
}

export class UpdateAppSettingsUseCase {
  constructor(
    private readonly settingsRepo: AppSettingsRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(input: {
    settings: { key: string; value: string }[];
    actorId: string;
    requestId?: string | null;
  }) {
    if (!input.settings.length) {
      throw new BadRequestError('VALIDATION_ERROR', 'settings tidak boleh kosong', [
        { field: 'settings', message: 'Minimal satu pengaturan' },
      ]);
    }

    for (const s of input.settings) {
      if (!ALLOWED.has(s.key)) {
        throw new BadRequestError('VALIDATION_ERROR', `Key tidak diizinkan: ${s.key}`, [
          { field: 'settings', message: `Key ${s.key} tidak diizinkan` },
        ]);
      }
      if (s.key === 'oauth.third_party_registration') {
        if (s.value !== 'open' && s.value !== 'closed') {
          throw new BadRequestError(
            'VALIDATION_ERROR',
            'oauth.third_party_registration harus open atau closed',
            [{ field: 'settings', message: 'Nilai third_party_registration tidak valid' }],
          );
        }
      }
      if (s.key === 'oauth.request_log_retention_days') {
        const n = Number(s.value);
        if (!Number.isInteger(n) || n < 1 || n > 3650) {
          throw new BadRequestError(
            'VALIDATION_ERROR',
            'Retensi log harus bilangan 1-3650',
            [{ field: 'settings', message: 'Nilai retensi tidak valid' }],
          );
        }
      }
      if (
        s.key === 'notification.review_approve_push_cooldown_minutes' ||
        s.key === 'notification.review_reject_push_cooldown_minutes' ||
        s.key === 'notification.word_comment_push_cooldown_minutes' ||
        s.key === 'notification.word_vote_push_cooldown_minutes'
      ) {
        const n = Number(s.value);
        if (!Number.isInteger(n) || n < 0 || n > 10080) {
          throw new BadRequestError(
            'VALIDATION_ERROR',
            'Cooldown push harus bilangan 0-10080 menit',
            [{ field: 'settings', message: 'Nilai cooldown tidak valid' }],
          );
        }
      }
      if (s.key === WA_VERIFIER_ENABLED_KEY) {
        const v = s.value.toLowerCase();
        if (v !== 'true' && v !== 'false') {
          throw new BadRequestError(
            'VALIDATION_ERROR',
            'wa.verifier_enabled harus true atau false',
            [{ field: 'settings', message: 'Nilai wa.verifier_enabled tidak valid' }],
          );
        }
      }
      if (s.key === WA_GROUP_CTA_URL_KEY) {
        if (!/^https?:\/\/\S+$/.test(s.value)) {
          throw new BadRequestError(
            'VALIDATION_ERROR',
            'wa.group_cta_url harus URL http/https yang valid',
            [{ field: 'settings', message: 'Nilai wa.group_cta_url tidak valid' }],
          );
        }
      }
    }

    const updated = await this.settingsRepo.upsertMany(
      input.settings.map((s) => ({ key: s.key as AppSettingKey, value: s.value })),
      input.actorId,
    );

    await this.auditRepo.record({
      userId: input.actorId,
      action: 'update',
      entityType: 'app_settings',
      entityId: 'app_settings',
      newData: Object.fromEntries(updated.map((u) => [u.key, u.value])),
      requestId: input.requestId ?? null,
    });

    return updated;
  }
}
