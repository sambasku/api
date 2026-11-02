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
