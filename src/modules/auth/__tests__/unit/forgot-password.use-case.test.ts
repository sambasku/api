import { describe, it, expect, vi } from 'vitest';
import { ForgotPasswordUseCase } from '../../application/use-cases/forgot-password.use-case';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { PasswordResetTokenRepository } from '../../domain/repositories/password-reset-token.repository';
import type { MailerPort } from '../../application/ports/mailer.port';
import type { AuthIdentityRepository } from '../../domain/repositories/auth-identity.repository';
import type { User } from '../../domain/entities/user.entity';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: '01TESTULIDUSERID00000000',
    username: 'budi',
    displayName: 'tester',
    bio: null,
    regionId: null,
    villageId: null,
    email: 'budi@test.com',
    phone: null,
    passwordHash: 'argon2id$hash',
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

function makeDeps(user: User | null, identities: { provider: string }[] = []) {
const userRepo = {
findByEmail: vi.fn().mockResolvedValue(user),
} as unknown as UserRepository;
const resetTokenRepo = {
create: vi.fn().mockResolvedValue({}),
invalidateUnusedForUser: vi.fn().mockResolvedValue(undefined),
} as unknown as PasswordResetTokenRepository;
const mailer = {
sendResetPasswordEmail: vi.fn().mockResolvedValue(undefined),
sendVerificationOtpEmail: vi.fn(),
} as unknown as MailerPort;
const identityRepo = {
listActiveByUserId: vi.fn().mockResolvedValue(identities),
} as unknown as AuthIdentityRepository;
return {
resetTokenRepo,
mailer,
identityRepo,
useCase: new ForgotPasswordUseCase(
userRepo,
resetTokenRepo,
mailer,
'https://app.test/reset-password',
identityRepo,
),
};
}

describe('ForgotPasswordUseCase', () => {
  it('email tidak terdaftar: diam, tidak kirim (anti-enumeration)', async () => {
    const { useCase, mailer, resetTokenRepo } = makeDeps(null);
    await useCase.execute({ email: 'hantu@test.com' });
    expect(resetTokenRepo.create).not.toHaveBeenCalled();
    expect(mailer.sendResetPasswordEmail).not.toHaveBeenCalled();
  });

  it('user ada: hanguskan token lama, buat token baru, kirim email', async () => {
    const { useCase, resetTokenRepo, mailer } = makeDeps(makeUser());
    await useCase.execute({ email: 'budi@test.com' });
    expect(resetTokenRepo.invalidateUnusedForUser).toHaveBeenCalledWith(
      '01TESTULIDUSERID00000000',
    );
    expect(resetTokenRepo.create).toHaveBeenCalledTimes(2);
expect(mailer.sendResetPasswordEmail).toHaveBeenCalledWith(
'budi@test.com',
expect.stringMatching(/^https:\/\/app\.test\/reset-password\?token=/),
expect.stringMatching(/^[0-9A-Z]{3}-[0-9A-Z]{3}$/),
);
});

it('akun OAuth-only: error OAUTH_ACCOUNT + nama provider, tidak kirim email', async () => {
const { useCase, mailer, resetTokenRepo } = makeDeps(
makeUser({ passwordHash: null }),
[{ provider: 'google' }],
);
await expect(useCase.execute({ email: 'budi@test.com' })).rejects.toMatchObject({
errorCode: 'OAUTH_ACCOUNT',
});
expect(resetTokenRepo.create).not.toHaveBeenCalled();
expect(mailer.sendResetPasswordEmail).not.toHaveBeenCalled();
});

it('akun OAuth-only + email sintetis: diam (tidak ada yang bisa dikasih tahu)', async () => {
const { useCase, mailer } = makeDeps(
makeUser({ passwordHash: null, email: 'go_12345@users.noreply.sambasku.local' }),
[{ provider: 'google' }],
);
await useCase.execute({ email: 'go_12345@users.noreply.sambasku.local' });
expect(mailer.sendResetPasswordEmail).not.toHaveBeenCalled();
});

it('akun tanpa password tapi tanpa identity OAuth: diam (tidak bocorkan info)', async () => {
const { useCase, mailer } = makeDeps(makeUser({ passwordHash: null }), []);
await useCase.execute({ email: 'budi@test.com' });
expect(mailer.sendResetPasswordEmail).not.toHaveBeenCalled();
});
});
