import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { AppVariables, AuthUser } from '@/shared/types';
import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';
import type { UserConsentRepository } from '@/modules/legal/domain/repositories/user-consent.repository';
import { createRequireLegalConsentMiddleware } from '../require-legal-consent.middleware';

const ACTIVE = { termsVersion: '2026-01-01', privacyVersion: '2026-01-01' };
const USER: AuthUser = { user_id: 'u1', roles: ['contributor'], role: 'contributor' };

function makeApp(opts: {
  activeVersions: { termsVersion: string; privacyVersion: string } | null;
  termsVersion?: string | null;
  privacyVersion?: string | null;
  seedUser?: AuthUser;
  mode?: 'lenient' | 'enforce';
}) {
  const settingsRepo = {
    getLegalActiveVersions: vi.fn().mockResolvedValue(opts.activeVersions),
    getOauthConsentEnforcement: vi.fn().mockResolvedValue(opts.mode ?? 'enforce'),
  } as unknown as AppSettingsRepository;
  const consentRepo = {
    findLatestByUser: vi.fn().mockImplementation(async (_userId: string, type: string) => {
      const v = type === 'terms' ? opts.termsVersion : opts.privacyVersion;
      return v ? { documentVersion: v } : null;
    }),
    findLatestByUserAll: vi.fn().mockImplementation(async (_userId: string) => {
      const out: Record<string, { documentVersion: string }> = {};
      if (opts.termsVersion) out.terms = { documentVersion: opts.termsVersion };
      if (opts.privacyVersion) out.privacy = { documentVersion: opts.privacyVersion };
      return out;
    }),
  } as unknown as UserConsentRepository;

  const app = new Hono<{ Variables: AppVariables }>();
  app.use('*', async (c, next) => {
    if (opts.seedUser) c.set('user', opts.seedUser);
    await next();
  });
  app.use('*', createRequireLegalConsentMiddleware(settingsRepo, consentRepo));
  app.post('/', (c) => c.json({ ok: true }));
  return app;
}

describe('createRequireLegalConsentMiddleware', () => {
  it('user tanpa consent -> 403 CONSENT_REQUIRED', async () => {
    const app = makeApp({ activeVersions: ACTIVE, seedUser: USER });
    const res = await app.request('/', { method: 'POST' });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error_code: string };
    expect(body.error_code).toBe('CONSENT_REQUIRED');
  });

  it('consent versi lama -> 403 CONSENT_REQUIRED', async () => {
    const app = makeApp({
      activeVersions: ACTIVE,
      termsVersion: '2025-01-01',
      privacyVersion: '2025-01-01',
      seedUser: USER,
    });
    const res = await app.request('/', { method: 'POST' });
    expect(res.status).toBe(403);
  });

  it('consent versi aktif -> lolos', async () => {
    const app = makeApp({
      activeVersions: ACTIVE,
      termsVersion: ACTIVE.termsVersion,
      privacyVersion: ACTIVE.privacyVersion,
      seedUser: USER,
    });
    const res = await app.request('/', { method: 'POST' });
    expect(res.status).toBe(200);
  });

  it('legal belum dikonfigurasi -> lolos (tidak ada dokumen untuk disetujui)', async () => {
    const app = makeApp({ activeVersions: null, seedUser: USER });
    const res = await app.request('/', { method: 'POST' });
    expect(res.status).toBe(200);
  });

  it('tanpa user (kontribusi anon) -> lolos', async () => {
    const app = makeApp({ activeVersions: ACTIVE });
    const res = await app.request('/', { method: 'POST' });
    expect(res.status).toBe(200);
  });

  it('mode lenient -> lolos walau tanpa consent (app lama tidak stuck)', async () => {
    const app = makeApp({ activeVersions: ACTIVE, mode: 'lenient', seedUser: USER });
    const res = await app.request('/', { method: 'POST' });
    expect(res.status).toBe(200);
  });

  it('mode lenient -> versi consent basi juga lolos', async () => {
    const app = makeApp({
      activeVersions: ACTIVE,
      termsVersion: '2025-01-01',
      privacyVersion: '2025-01-01',
      mode: 'lenient',
      seedUser: USER,
    });
    const res = await app.request('/', { method: 'POST' });
    expect(res.status).toBe(200);
  });
});
