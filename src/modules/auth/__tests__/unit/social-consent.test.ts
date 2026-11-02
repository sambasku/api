import { describe, it, expect, vi } from 'vitest';
import { SocialConsentService } from '../../application/utils/social-consent';
import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';
import type { UserConsentRepository } from '@/modules/legal/domain/repositories/user-consent.repository';

const ACTIVE = { termsVersion: '2026-10-04', privacyVersion: '2026-10-04' };

function makeDeps(opts: {
  enforcement?: 'lenient' | 'enforce';
  latestTerms?: { documentVersion: string } | null;
} = {}) {
  const settingsRepo = {
    getLegalActiveVersions: vi.fn().mockResolvedValue(ACTIVE),
    getOauthConsentEnforcement: vi.fn().mockResolvedValue(opts.enforcement ?? 'lenient'),
  } as unknown as AppSettingsRepository;
  const consentRepo = {
    findLatestByUser: vi.fn().mockResolvedValue(opts.latestTerms ?? null),
    insertMany: vi.fn().mockResolvedValue(undefined),
  } as unknown as UserConsentRepository;
  return {
    service: new SocialConsentService(settingsRepo, consentRepo),
    settingsRepo,
    consentRepo,
  };
}

const USER_ID = '01TESTUSER0000000000000001';

describe('SocialConsentService', () => {
  it('user baru tanpa consents -> needsConsent true, TIDAK menulis baris consent', async () => {
    const { service, consentRepo } = makeDeps();

    const outcome = await service.recordForLogin(USER_ID, undefined, {});

    expect(outcome.needsConsent).toBe(true);
    // Regresi: backfill diam-diam bikin /users/me balas requires_consent
    // false sehingga sheet persetujuan tidak pernah muncul.
    expect(consentRepo.insertMany).not.toHaveBeenCalled();
  });

  it('user existing tanpa consent -> needsConsent true, tanpa insert', async () => {
    const { service, consentRepo } = makeDeps({ latestTerms: null });

    const outcome = await service.recordForLogin(USER_ID, [], {});

    expect(outcome.needsConsent).toBe(true);
    expect(consentRepo.insertMany).not.toHaveBeenCalled();
  });

  it('consents eksplisit versi aktif -> simpan source register, tanpa sheet', async () => {
    const { service, consentRepo } = makeDeps();

    const outcome = await service.recordForLogin(
      USER_ID,
      [
        { documentType: 'terms', documentVersion: ACTIVE.termsVersion },
        { documentType: 'privacy', documentVersion: ACTIVE.privacyVersion },
      ],
      { clientId: 'sambasku-mobile' },
    );

    expect(outcome.needsConsent).toBe(false);
    expect(consentRepo.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ documentType: 'terms', source: 'register' }),
      expect.objectContaining({ documentType: 'privacy', source: 'register' }),
    ]);
  });

  it('consents versi basi -> needsConsent true, tidak menimpa riwayat', async () => {
    const { service, consentRepo } = makeDeps({
      latestTerms: { documentVersion: '2025-01-01' },
    });

    const outcome = await service.recordForLogin(
      USER_ID,
      [
        { documentType: 'terms', documentVersion: '2025-01-01' },
        { documentType: 'privacy', documentVersion: '2025-01-01' },
      ],
      {},
    );

    expect(outcome.needsConsent).toBe(true);
    expect(consentRepo.insertMany).not.toHaveBeenCalled();
  });

  it('consent sudah versi aktif -> tidak insert lagi, tanpa sheet', async () => {
    const { service, consentRepo } = makeDeps({
      latestTerms: { documentVersion: ACTIVE.termsVersion },
    });

    const outcome = await service.recordForLogin(USER_ID, undefined, {});

    expect(outcome.needsConsent).toBe(false);
    expect(consentRepo.insertMany).not.toHaveBeenCalled();
  });

  it('mode enforce + akun baru tanpa consents -> CONSENT_REQUIRED', async () => {
    const { service } = makeDeps({ enforcement: 'enforce' });

    await expect(service.assertForNewUser(undefined)).rejects.toMatchObject({
      errorCode: 'CONSENT_REQUIRED',
    });
  });
});
