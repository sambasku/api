import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { AppVariables, AuthUser } from '@/shared/types';
import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';
import type { UserConsentRepository } from '@/modules/legal/domain/repositories/user-consent.repository';
import { createRequireLegalConsentMiddleware } from '../require-legal-consent.middleware';

/**
 * Budget query gate consent (docs AGENTS.md #26): 1 query settings +
 * 1 query consent = 2 per request tulis (mode enforce). Mode lenient
 * cuma 1 query settings. Regresi ke pola N+1 langsung ketahuan di sini.
 */
const ACTIVE = { termsVersion: '2026-01-01', privacyVersion: '2026-01-01' };
const USER: AuthUser = { user_id: 'u1', roles: ['contributor'], role: 'contributor' };

function mount(mode: 'lenient' | 'enforce') {
  const settingsRepo = {
    getOauthConsentEnforcement: vi.fn().mockResolvedValue(mode),
    getLegalActiveVersions: vi.fn().mockResolvedValue(ACTIVE),
  } as unknown as AppSettingsRepository;
  const consentRepo = {
    findLatestByUser: vi.fn().mockResolvedValue({ documentVersion: '2025-01-01' }),
    findLatestByUserAll: vi.fn().mockResolvedValue({
      terms: { documentVersion: '2025-01-01' },
      privacy: { documentVersion: '2025-01-01' },
    }),
  } as unknown as UserConsentRepository;

  const app = new Hono<{ Variables: AppVariables }>();
  app.use('*', async (c, next) => {
    c.set('user', USER);
    await next();
  });
  app.use('*', createRequireLegalConsentMiddleware(settingsRepo, consentRepo));
  app.post('/', (c) => c.json({ ok: true }));
  return { app, settingsRepo, consentRepo };
}

describe('gate consent - budget query', () => {
  it('mode enforce -> maksimal 1 query settings + 1 query consent', async () => {
    const { app, settingsRepo, consentRepo } = mount('enforce');

    await app.request('/', { method: 'POST' });

    const settingsCalls =
      vi.mocked(settingsRepo.getOauthConsentEnforcement).mock.calls.length +
      vi.mocked(settingsRepo.getLegalActiveVersions).mock.calls.length;
    const consentCalls =
      vi.mocked(consentRepo.findLatestByUser).mock.calls.length +
      vi.mocked(consentRepo.findLatestByUserAll).mock.calls.length;

    expect(settingsCalls).toBe(2); // flag + versi aktif (2 key, 1 query)
    expect(consentCalls).toBe(1); // findLatestByUserAll, bukan 2x findLatestByUser
  });

  it('mode lenient -> nol query consent (gate mati)', async () => {
    const { app, consentRepo } = mount('lenient');

    await app.request('/', { method: 'POST' });

    expect(vi.mocked(consentRepo.findLatestByUser).mock.calls.length).toBe(0);
    expect(vi.mocked(consentRepo.findLatestByUserAll).mock.calls.length).toBe(0);
  });
});
