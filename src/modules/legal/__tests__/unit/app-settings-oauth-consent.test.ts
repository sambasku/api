import { describe, it, expect, vi } from 'vitest';
import { UpdateAppSettingsUseCase } from '../../application/use-cases/app-settings.use-cases';
import type { AppSettingsRepository } from '../../domain/repositories/app-settings.repository';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';

function makeDeps() {
  const settingsRepo = {
    upsertMany: vi.fn().mockResolvedValue([]),
    getByKeys: vi.fn().mockResolvedValue([]),
    getValue: vi.fn(),
    setIfAbsent: vi.fn(),
    getLegalActiveVersions: vi.fn(),
    getOauthConsentEnforcement: vi.fn(),
  } as unknown as AppSettingsRepository;
  const auditRepo = { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditLogRepository;
  return { useCase: new UpdateAppSettingsUseCase(settingsRepo, auditRepo), settingsRepo, auditRepo };
}

const ACTOR = '01ACTOR000000000000000001';

describe('UpdateAppSettingsUseCase - legal.oauth_consent_enforcement', () => {
  it('menerima lenient', async () => {
    const { useCase, settingsRepo } = makeDeps();
    await useCase.execute({
      settings: [{ key: 'legal.oauth_consent_enforcement', value: 'lenient' }],
      actorId: ACTOR,
    });
    expect(settingsRepo.upsertMany).toHaveBeenCalledOnce();
  });

  it('menerima enforce', async () => {
    const { useCase, settingsRepo } = makeDeps();
    await useCase.execute({
      settings: [{ key: 'legal.oauth_consent_enforcement', value: 'enforce' }],
      actorId: ACTOR,
    });
    expect(settingsRepo.upsertMany).toHaveBeenCalledOnce();
  });

  it('menolak nilai lain', async () => {
    const { useCase, settingsRepo } = makeDeps();
    await expect(
      useCase.execute({
        settings: [{ key: 'legal.oauth_consent_enforcement', value: 'hard' }],
        actorId: ACTOR,
      }),
    ).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
    expect(settingsRepo.upsertMany).not.toHaveBeenCalled();
  });
});

describe('UpdateAppSettingsUseCase - *_enabled boolean', () => {
  it('memaksa type boolean saat upsert kill switch', async () => {
    const { useCase, settingsRepo } = makeDeps();
    await useCase.execute({
      settings: [
        {
          key: 'search_miss_auto_visible_enabled',
          value: 'true',
          type: 'string',
        },
      ],
      actorId: ACTOR,
    });
    expect(settingsRepo.upsertMany).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          key: 'search_miss_auto_visible_enabled',
          value: 'true',
          type: 'boolean',
        }),
      ],
      ACTOR,
    );
  });

  it('menolak nilai selain true/false', async () => {
    const { useCase, settingsRepo } = makeDeps();
    await expect(
      useCase.execute({
        settings: [{ key: 'auto_verify_by_vote_enabled', value: '1' }],
        actorId: ACTOR,
      }),
    ).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
    expect(settingsRepo.upsertMany).not.toHaveBeenCalled();
  });
});

describe('UpdateAppSettingsUseCase - wa_group_notify_enabled', () => {
  it('memaksa type boolean saat upsert', async () => {
    const { useCase, settingsRepo } = makeDeps();
    await useCase.execute({
      settings: [{ key: 'wa_group_notify_enabled', value: 'true', type: 'string' }],
      actorId: ACTOR,
    });
    expect(settingsRepo.upsertMany).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          key: 'wa_group_notify_enabled',
          value: 'true',
          type: 'boolean',
        }),
      ],
      ACTOR,
    );
  });

  it.each(['1', 'yes', ''])('menolak nilai %j', async (value) => {
    const { useCase, settingsRepo } = makeDeps();
    await expect(
      useCase.execute({
        settings: [{ key: 'wa_group_notify_enabled', value }],
        actorId: ACTOR,
      }),
    ).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
    expect(settingsRepo.upsertMany).not.toHaveBeenCalled();
  });
});
