import { describe, it, expect, vi } from 'vitest';
import { ServiceUnavailableError, UnauthorizedError } from '@/shared/errors/app-error';
import { LoginWithGoogleUseCase } from '../../application/use-cases/login-with-google.use-case';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { AuthIdentityRepository } from '../../domain/repositories/auth-identity.repository';
import type { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository';
import type { TokenServicePort } from '../../application/ports/token-service.port';
import type { GoogleTokenVerifierPort } from '../../application/ports/google-token-verifier.port';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';
import type { UserConsentRepository } from '@/modules/legal/domain/repositories/user-consent.repository';
import { SocialConsentService } from '../../application/utils/social-consent';
import type { User } from '../../domain/entities/user.entity';
import type { AuthIdentity } from '../../domain/entities/auth-identity.entity';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: '01TESTGOOGLEUSER000000001',
    username: 'budi',
    displayName: 'budi',
    bio: null,
    regionId: null,
    villageId: null,
    email: 'budi@gmail.com',
    phone: null,
    passwordHash: null,
    roles: ['contributor'],
    role: 'contributor',
    isActive: true,
    emailVerified: true,
    avatarUrl: null,
    avatarProvider: null,
    avatarProviderFileId: null,
    avatarSha: null,
    createdAt: new Date(),
    updatedAt: null,
    deletedAt: null,
    ...overrides,
    canContribute: overrides.canContribute ?? true,
    contributeMutedUntil: overrides.contributeMutedUntil ?? null,
    readContributionGuideAt: overrides.readContributionGuideAt ?? null,
  };
}

function makeIdentity(overrides: Partial<AuthIdentity> = {}): AuthIdentity {
  return {
    id: '01TESTGOOGLEIDENT00000001',
    userId: '01TESTGOOGLEUSER000000001',
    provider: 'google',
    providerUserId: 'google-sub-1',
    emailAtProvider: 'budi@gmail.com',
    createdAt: new Date(),
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  };
}

const CLAIMS = {
  sub: 'google-sub-1',
  email: 'budi@gmail.com',
  emailVerified: true,
  name: 'Budi Santoso',
};

function makeDeps(opts: {
  claims?: typeof CLAIMS | Error;
  identity?: AuthIdentity | null;
  userById?: User | null;
  userByEmail?: User | null;
  usernamesTaken?: string[];
  created?: boolean;
  legal?: {
    activeVersions?: { termsVersion: string; privacyVersion: string } | null;
    enforcement?: 'lenient' | 'enforce';
    latestTerms?: { documentVersion: string } | null;
  };
} = {}) {
  const claimsOrErr = opts.claims ?? CLAIMS;
  const verifier: GoogleTokenVerifierPort = {
    verify: vi.fn().mockImplementation(async () => {
      if (claimsOrErr instanceof Error) throw claimsOrErr;
      return claimsOrErr;
    }),
  };

  const taken = new Set(opts.usernamesTaken ?? []);
  const createdUser = makeUser({ username: 'Budi Santoso' });
  const createdIdentity = makeIdentity();

  const userRepo = {
    findById: vi.fn().mockResolvedValue(opts.userById === undefined ? makeUser() : opts.userById),
    findByEmail: vi.fn().mockResolvedValue(opts.userByEmail ?? null),
    findByUsername: vi.fn().mockImplementation(async (name: string) =>
      taken.has(name) ? makeUser({ username: name }) : null,
    ),
    save: vi.fn(),
  } as unknown as UserRepository;

  const identityRepo = {
    findByProvider: vi.fn().mockResolvedValue(opts.identity === undefined ? null : opts.identity),
    create: vi.fn(),
    createUserWithGoogleIdentity: vi.fn().mockResolvedValue({
      user: createdUser,
      identity: createdIdentity,
      created: opts.created ?? true,
    }),
  } as unknown as AuthIdentityRepository;

  const tokenService = {
    generateAccessToken: vi.fn().mockResolvedValue('jwt-google'),
    verifyAccessToken: vi.fn(),
  } as unknown as TokenServicePort;

  const refreshTokenRepo = {
    create: vi.fn().mockResolvedValue({}),
    findByHash: vi.fn(),
    revokeByHash: vi.fn(),
    revokeAllForUser: vi.fn(),
  } as unknown as RefreshTokenRepository;

  const auditRepo = {
    record: vi.fn().mockResolvedValue(undefined),
    list: vi.fn(),
  } as unknown as AuditLogRepository;

  // Consent service dibuat dengan repo palsu: default legal belum
  // dikonfigurasi (getLegalActiveVersions null) = tidak ada backfill,
  // sehingga assertion lama tetap valid. Test consent meng-override.
  const legal = opts.legal ?? {};
  const settingsRepo = {
    getLegalActiveVersions: vi.fn().mockResolvedValue(legal.activeVersions ?? null),
    getOauthConsentEnforcement: vi.fn().mockResolvedValue(legal.enforcement ?? 'lenient'),
  } as unknown as AppSettingsRepository;
  const consentRepo = {
    findLatestByUser: vi.fn().mockImplementation(async () =>
      legal.latestTerms === undefined ? null : legal.latestTerms,
    ),
    insertMany: vi.fn().mockResolvedValue(undefined),
  } as unknown as UserConsentRepository;

  const useCase = new LoginWithGoogleUseCase(
    userRepo,
    identityRepo,
    verifier,
    tokenService,
    refreshTokenRepo,
    auditRepo,
    new SocialConsentService(settingsRepo, consentRepo),
    900,
    2592000,
  );

  return { useCase, userRepo, identityRepo, verifier, refreshTokenRepo, auditRepo, settingsRepo, consentRepo };
}

describe('LoginWithGoogleUseCase', () => {
  it('identity ada + user aktif → sesi, tidak save user, tidak audit', async () => {
    const { useCase, identityRepo, userRepo, auditRepo, refreshTokenRepo } = makeDeps({
      identity: makeIdentity(),
      userById: makeUser(),
    });

    const result = await useCase.execute({ idToken: 'id-token' });

    expect(result.accessToken).toBe('jwt-google');
    expect(result.user).toEqual({
      id: '01TESTGOOGLEUSER000000001',
      username: 'budi',
      displayName: 'budi',
      roles: ['contributor'],
      role: 'contributor',
      avatarUrl: null,
    });
    expect(identityRepo.createUserWithGoogleIdentity).not.toHaveBeenCalled();
    expect(userRepo.findByEmail).not.toHaveBeenCalled();
    expect(auditRepo.record).not.toHaveBeenCalled();
    expect(refreshTokenRepo.create).toHaveBeenCalledOnce();
  });

  it('identity tidak ada + email sudah di users → akun baru dengan email sintetis', async () => {
    const { useCase, identityRepo } = makeDeps({
      identity: null,
      userByEmail: makeUser({ passwordHash: 'hash' }),
    });

    await useCase.execute({ idToken: 'id-token' });

    expect(identityRepo.createUserWithGoogleIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'go_google-sub-1@users.noreply.sambasku.local',
        passwordHash: null,
        displayName: 'Budi Santoso',
        username: 'budi_santoso',
      }),
      expect.objectContaining({
        provider: 'google',
        emailAtProvider: 'budi@gmail.com',
      }),
    );
  });

  it('identity tidak ada + email baru → save user passwordHash null + identity + audit via google', async () => {
    const { useCase, identityRepo, auditRepo } = makeDeps({ identity: null, userByEmail: null });

    const result = await useCase.execute({ idToken: 'id-token' }, {}, 'req-1');

    expect(result.accessToken).toBe('jwt-google');
    expect(identityRepo.createUserWithGoogleIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'budi@gmail.com',
        passwordHash: null,
        phone: null,
        emailVerified: true,
        username: 'budi_santoso',
        displayName: 'Budi Santoso',
      }),
      expect.objectContaining({
        provider: 'google',
        providerUserId: 'google-sub-1',
        emailAtProvider: 'budi@gmail.com',
      }),
    );
    expect(auditRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create',
        entityType: 'user',
        newData: expect.objectContaining({ via: 'google', email: 'budi@gmail.com' }),
        requestId: 'req-1',
      }),
    );
  });

  it('email_verified false / verify throw → INVALID_GOOGLE_TOKEN', async () => {
    const { useCase, identityRepo } = makeDeps({
      claims: new UnauthorizedError('INVALID_GOOGLE_TOKEN', 'Tidak bisa masuk dengan Google.'),
    });

    await expect(useCase.execute({ idToken: 'bad' })).rejects.toMatchObject({
      errorCode: 'INVALID_GOOGLE_TOKEN',
      statusCode: 401,
    });
    expect(identityRepo.findByProvider).not.toHaveBeenCalled();
  });

  it('identity deletedAt terisi → INVALID_GOOGLE_TOKEN', async () => {
    const { useCase, auditRepo } = makeDeps({
      identity: makeIdentity({ deletedAt: new Date() }),
    });

    await expect(useCase.execute({ idToken: 'id-token' })).rejects.toMatchObject({
      errorCode: 'INVALID_GOOGLE_TOKEN',
    });
    expect(auditRepo.record).not.toHaveBeenCalled();
  });

  it('user isActive false / deletedAt → INVALID_GOOGLE_TOKEN', async () => {
    const { useCase } = makeDeps({
      identity: makeIdentity(),
      userById: makeUser({ isActive: false }),
    });

    await expect(useCase.execute({ idToken: 'id-token' })).rejects.toMatchObject({
      errorCode: 'INVALID_GOOGLE_TOKEN',
    });

    const deleted = makeDeps({
      identity: makeIdentity(),
      userById: makeUser({ deletedAt: new Date() }),
    });
    await expect(deleted.useCase.execute({ idToken: 'id-token' })).rejects.toMatchObject({
      errorCode: 'INVALID_GOOGLE_TOKEN',
    });
  });

  it('username bentrok → sufiks terpakai', async () => {
    const { useCase, identityRepo } = makeDeps({
      identity: null,
      usernamesTaken: ['budi_santoso'],
    });

    await useCase.execute({ idToken: 'id-token' });

    expect(identityRepo.createUserWithGoogleIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'budi_santoso_google' }),
      expect.any(Object),
    );
  });

  it('verifier 503 GOOGLE_AUTH_UNAVAILABLE menjalar', async () => {
    const { useCase } = makeDeps({
      claims: new ServiceUnavailableError(
        'GOOGLE_AUTH_UNAVAILABLE',
        'Masuk dengan Google sedang tidak tersedia.',
      ),
    });

    await expect(useCase.execute({ idToken: 'id-token' })).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
    await expect(useCase.execute({ idToken: 'id-token' })).rejects.toMatchObject({
      errorCode: 'GOOGLE_AUTH_UNAVAILABLE',
      statusCode: 503,
    });
  });

  // --- Consent legal (rollout OAuth hard gate) ---

  const ACTIVE = { termsVersion: '2026-01-01', privacyVersion: '2026-01-01' };

  it('akun baru + consents valid -> simpan consent source register, tanpa sheet', async () => {
    const { useCase, consentRepo, identityRepo } = makeDeps({
      identity: null,
      legal: { activeVersions: ACTIVE },
    });

    const result = await useCase.execute({
      idToken: 'id-token',
      consents: [
        { documentType: 'terms', documentVersion: '2026-01-01' },
        { documentType: 'privacy', documentVersion: '2026-01-01' },
      ],
    });

    expect(identityRepo.createUserWithGoogleIdentity).toHaveBeenCalled();
    expect(consentRepo.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ documentType: 'terms', documentVersion: '2026-01-01', source: 'register' }),
      expect.objectContaining({ documentType: 'privacy', documentVersion: '2026-01-01', source: 'register' }),
    ]);
    // User sudah centang checkbox di halaman Daftar - tidak perlu sheet lagi.
    expect(result.requiresConsent).toBeUndefined();
  });

  it('akun baru + consents versi basi -> LEGAL_CONSENT_OUTDATED, akun tidak dibuat', async () => {
    const { useCase, consentRepo, identityRepo } = makeDeps({
      identity: null,
      legal: { activeVersions: ACTIVE },
    });

    await expect(
      useCase.execute({
        idToken: 'id-token',
        consents: [
          { documentType: 'terms', documentVersion: '2025-01-01' },
          { documentType: 'privacy', documentVersion: '2025-01-01' },
        ],
      }),
    ).rejects.toMatchObject({ errorCode: 'LEGAL_CONSENT_OUTDATED' });

    expect(identityRepo.createUserWithGoogleIdentity).not.toHaveBeenCalled();
    expect(consentRepo.insertMany).not.toHaveBeenCalled();
  });

  it('akun baru tanpa consents, mode lenient -> backfill social_gate', async () => {
    const { useCase, consentRepo, identityRepo } = makeDeps({
      identity: null,
      legal: { activeVersions: ACTIVE, enforcement: 'lenient' },
    });

    const result = await useCase.execute({ idToken: 'id-token' });

    expect(identityRepo.createUserWithGoogleIdentity).toHaveBeenCalled();
    expect(consentRepo.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ documentType: 'terms', source: 'social_gate' }),
      expect.objectContaining({ documentType: 'privacy', source: 'social_gate' }),
    ]);
    expect(result.requiresConsent).toBe(true);
  });

  it('akun baru tanpa consents, mode enforce -> CONSENT_REQUIRED, akun tidak dibuat', async () => {
    const { useCase, consentRepo, identityRepo } = makeDeps({
      identity: null,
      legal: { activeVersions: ACTIVE, enforcement: 'enforce' },
    });

    await expect(useCase.execute({ idToken: 'id-token' })).rejects.toMatchObject({
      errorCode: 'CONSENT_REQUIRED',
      statusCode: 400,
    });
    expect(identityRepo.createUserWithGoogleIdentity).not.toHaveBeenCalled();
    expect(consentRepo.insertMany).not.toHaveBeenCalled();
  });

  it('akun lama tanpa consent -> backfill social_gate, requiresConsent true', async () => {
    const { useCase, consentRepo } = makeDeps({
      identity: makeIdentity(),
      userById: makeUser(),
      legal: { activeVersions: ACTIVE, latestTerms: null },
    });

    const result = await useCase.execute({ idToken: 'id-token' });

    expect(consentRepo.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ documentType: 'terms', source: 'social_gate' }),
      expect.objectContaining({ documentType: 'privacy', source: 'social_gate' }),
    ]);
    expect(result.requiresConsent).toBe(true);
  });

  it('akun lama dengan consent -> tidak insert baru, requiresConsent undefined', async () => {
    const { useCase, consentRepo } = makeDeps({
      identity: makeIdentity(),
      userById: makeUser(),
      legal: { activeVersions: ACTIVE, latestTerms: { documentVersion: '2026-01-01' } },
    });

    const result = await useCase.execute({ idToken: 'id-token' });

    expect(consentRepo.insertMany).not.toHaveBeenCalled();
    expect(result.requiresConsent).toBeUndefined();
  });

  it('legal belum dikonfigurasi -> login sukses, tanpa backfill', async () => {
    const { useCase, consentRepo, identityRepo } = makeDeps({
      identity: null,
      legal: { activeVersions: null, enforcement: 'enforce' },
    });

    const result = await useCase.execute({ idToken: 'id-token' });

    expect(identityRepo.createUserWithGoogleIdentity).toHaveBeenCalled();
    expect(consentRepo.insertMany).not.toHaveBeenCalled();
    expect(result.requiresConsent).toBeUndefined();
  });

  // --- Anomali: user existing datang lewat halaman Daftar ---

  it('akun lama tanpa consent + centang checkbox di Daftar -> simpan, tanpa sheet', async () => {
    const { useCase, consentRepo } = makeDeps({
      identity: makeIdentity(),
      userById: makeUser(),
      legal: { activeVersions: ACTIVE, latestTerms: null },
    });

    const result = await useCase.execute({
      idToken: 'id-token',
      consents: [
        { documentType: 'terms', documentVersion: '2026-01-01' },
        { documentType: 'privacy', documentVersion: '2026-01-01' },
      ],
    });

    // Dulu consents user existing dibuang (recordForLogin(user.id, null))
    // -> sheet memaksa setuju ulang padahal baru saja centang.
    expect(consentRepo.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ documentType: 'terms', source: 'register' }),
      expect.objectContaining({ documentType: 'privacy', source: 'register' }),
    ]);
    expect(result.requiresConsent).toBeUndefined();
  });

  it('akun lama consent versi basi + consents client basi -> tidak timpa, tetap minta sheet', async () => {
    const { useCase, consentRepo } = makeDeps({
      identity: makeIdentity(),
      userById: makeUser(),
      legal: {
        activeVersions: ACTIVE,
        latestTerms: { documentVersion: '2025-01-01' },
      },
    });

    const result = await useCase.execute({
      idToken: 'id-token',
      consents: [
        { documentType: 'terms', documentVersion: '2025-01-01' },
        { documentType: 'privacy', documentVersion: '2025-01-01' },
      ],
    });

    // Jangan tulis persetujuan ke versi yang tidak pernah dilihat user
    // dalam bentuk aktif - riwayat lama utuh, user setuju ulang di sheet.
    expect(consentRepo.insertMany).not.toHaveBeenCalled();
    expect(result.requiresConsent).toBe(true);
  });

  it('akun lama consent versi basi + consents client versi aktif -> upgrade ke versi aktif', async () => {
    const { useCase, consentRepo } = makeDeps({
      identity: makeIdentity(),
      userById: makeUser(),
      legal: {
        activeVersions: ACTIVE,
        latestTerms: { documentVersion: '2025-01-01' },
      },
    });

    const result = await useCase.execute({
      idToken: 'id-token',
      consents: [
        { documentType: 'terms', documentVersion: '2026-01-01' },
        { documentType: 'privacy', documentVersion: '2026-01-01' },
      ],
    });

    expect(consentRepo.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ documentType: 'terms', documentVersion: '2026-01-01', source: 'register' }),
      expect.objectContaining({ documentType: 'privacy', documentVersion: '2026-01-01', source: 'register' }),
    ]);
    expect(result.requiresConsent).toBeUndefined();
  });
});
