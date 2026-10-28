import { describe, it, expect, vi } from 'vitest';
import { SetPasswordUseCase } from '../../application/use-cases/set-password.use-case';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { User } from '../../domain/entities/user.entity';
import type { AuthIdentityRepository } from '../../domain/repositories/auth-identity.repository';
import type { AuthIdentity } from '../../domain/entities/auth-identity.entity';
import type { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository';
import type { PasswordHasherPort } from '../../application/ports/password-hasher.port';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { GoogleTokenVerifierPort } from '../../application/ports/google-token-verifier.port';
import type { FacebookTokenVerifierPort } from '../../application/ports/facebook-token-verifier.port';
import type { GithubTokenVerifierPort } from '../../application/ports/github-token-verifier.port';
import type { SetPasswordDto } from '../../application/dto/set-password.dto';

const USER_ID = '01TESTULIDUSERID00000000';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: USER_ID,
    username: 'tester',
    displayName: 'tester',
    bio: null,
    regionId: null,
    villageId: null,
    email: 'tester@test.com',
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
    canContribute: true,
    contributeMutedUntil: null,
    readContributionGuideAt: null,
    ...overrides,
    levelSeen: overrides.levelSeen ?? 1,
    notifyStreakReminder: overrides.notifyStreakReminder ?? true,
    notifyLevelUp: overrides.notifyLevelUp ?? true,
  };
}

function makeIdentity(provider: string, providerUserId: string): AuthIdentity {
  return {
    id: '01IDENTITY000000000000001',
    userId: USER_ID,
    provider,
    providerUserId,
    emailAtProvider: 'tester@test.com',
    createdAt: new Date(),
    deletedAt: null,
    deletedBy: null,
  };
}

function makeDeps(user: User | null, identity: AuthIdentity | null) {
  const userRepo = {
    findById: vi.fn().mockResolvedValue(user),
    updatePassword: vi.fn().mockResolvedValue(undefined),
  } as unknown as UserRepository;
  const identityRepo = {
    findActiveByUserAndProvider: vi.fn().mockResolvedValue(identity),
  } as unknown as AuthIdentityRepository;
  const hasher = {
    hash: vi.fn().mockResolvedValue('pbkdf2-sha256$baru'),
    compare: vi.fn(),
  } as unknown as PasswordHasherPort;
  const auditRepo = { record: vi.fn().mockResolvedValue(undefined), list: vi.fn() };
  const refreshTokenRepo = {
    revokeAllForUser: vi.fn().mockResolvedValue(undefined),
  } as unknown as RefreshTokenRepository;
  const google = {
    verify: vi.fn().mockResolvedValue({ sub: 'gsub', email: 'a@b.c', emailVerified: true, name: null }),
  } as unknown as GoogleTokenVerifierPort;
  const facebook = {
    verify: vi.fn().mockResolvedValue({ facebookUserId: 'fbid', email: 'a@b.c', name: null }),
  } as unknown as FacebookTokenVerifierPort;
  const github = {
    verify: vi.fn().mockResolvedValue({ id: 'gh1', login: 'octo', name: null, email: null, avatarUrl: null }),
  } as unknown as GithubTokenVerifierPort;

  return {
    userRepo,
    hasher,
    auditRepo,
    refreshTokenRepo,
    google,
    useCase: new SetPasswordUseCase(
      userRepo,
      identityRepo,
      hasher,
      auditRepo as unknown as AuditLogRepository,
      refreshTokenRepo,
      google,
      facebook,
      github,
    ),
  };
}

const googleDto: SetPasswordDto = {
  provider: 'google',
  idToken: 'id',
  newPassword: 'PasswordBaru1',
};

describe('SetPasswordUseCase', () => {
  it('google: hash, revoke, audit, login_with email asli', async () => {
    const { useCase, userRepo, hasher, refreshTokenRepo, auditRepo } = makeDeps(
      makeUser(),
      makeIdentity('google', 'gsub'),
    );

    const result = await useCase.execute(googleDto, USER_ID, 'req-1');

    expect(result.loginWith).toBe('tester@test.com');
    expect(hasher.hash).toHaveBeenCalledWith('PasswordBaru1');
    expect(userRepo.updatePassword).toHaveBeenCalledWith(USER_ID, 'pbkdf2-sha256$baru');
    expect(refreshTokenRepo.revokeAllForUser).toHaveBeenCalledWith(USER_ID);
    expect(auditRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'password_change',
        newData: { changed: true, via: 'set_password', provider: 'google' },
      }),
    );
  });

  it('email sintetis → login_with username', async () => {
    const { useCase } = makeDeps(
      makeUser({ email: 'go_sub@users.noreply.sambasku.local', username: 'budi_google' }),
      makeIdentity('google', 'gsub'),
    );
    const result = await useCase.execute(googleDto, USER_ID);
    expect(result.loginWith).toBe('budi_google');
  });

  it('facebook dan github sukses bila id cocok', async () => {
    const fb = makeDeps(makeUser(), makeIdentity('facebook', 'fbid'));
    await expect(
      fb.useCase.execute({ provider: 'facebook', accessToken: 'tok', newPassword: 'PasswordBaru1' }, USER_ID),
    ).resolves.toMatchObject({ loginWith: 'tester@test.com' });

    const gh = makeDeps(makeUser(), makeIdentity('github', 'gh1'));
    await expect(
      gh.useCase.execute({ provider: 'github', accessToken: 'tok', newPassword: 'PasswordBaru1' }, USER_ID),
    ).resolves.toMatchObject({ loginWith: 'tester@test.com' });
  });

  it('hash sudah ada → PASSWORD_ALREADY_SET sebelum verifier', async () => {
    const { useCase, google, userRepo } = makeDeps(makeUser({ passwordHash: 'hash' }), makeIdentity('google', 'gsub'));
    await expect(useCase.execute(googleDto, USER_ID)).rejects.toMatchObject({ errorCode: 'PASSWORD_ALREADY_SET' });
    expect(google.verify).not.toHaveBeenCalled();
    expect(userRepo.updatePassword).not.toHaveBeenCalled();
  });

  it('sub tidak cocok → INVALID_GOOGLE_TOKEN', async () => {
    const { useCase, userRepo } = makeDeps(makeUser(), makeIdentity('google', 'lain'));
    await expect(useCase.execute(googleDto, USER_ID)).rejects.toMatchObject({ errorCode: 'INVALID_GOOGLE_TOKEN' });
    expect(userRepo.updatePassword).not.toHaveBeenCalled();
  });

  it('belum tertaut → GOOGLE_NOT_LINKED', async () => {
    const { useCase } = makeDeps(makeUser(), null);
    await expect(useCase.execute(googleDto, USER_ID)).rejects.toMatchObject({ errorCode: 'GOOGLE_NOT_LINKED' });
  });

  it('password lemah throw sebelum repo', async () => {
    const { useCase, userRepo } = makeDeps(makeUser(), makeIdentity('google', 'gsub'));
    await expect(
      useCase.execute({ ...googleDto, newPassword: 'pendek' }, USER_ID),
    ).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
    expect(userRepo.findById).not.toHaveBeenCalled();
  });
});
