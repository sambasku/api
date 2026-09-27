import { describe, it, expect, vi } from 'vitest';
import { LoginWithGithubUseCase } from '../../application/use-cases/login-with-github.use-case';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { AuthIdentityRepository } from '../../domain/repositories/auth-identity.repository';
import type { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository';
import type { TokenServicePort } from '../../application/ports/token-service.port';
import type { GithubTokenVerifierPort } from '../../application/ports/github-token-verifier.port';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { User } from '../../domain/entities/user.entity';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: '01TESTGITHUBUSER000000001',
    username: 'octocat',
    displayName: 'The Octocat',
    bio: null,
    email: 'octocat@github.com',
    phone: null,
    passwordHash: null,
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
    ...overrides,
  };
}

describe('LoginWithGithubUseCase', () => {
  it('email bentrok → email sintetis + login dari login GitHub', async () => {
    const verifier: GithubTokenVerifierPort = {
      verify: vi.fn().mockResolvedValue({
        id: '42',
        login: 'octocat',
        name: 'The Octocat',
        email: 'shared@email.com',
        avatarUrl: null,
      }),
    };

    const identityRepo = {
      findByProvider: vi.fn().mockResolvedValue(null),
      createUserWithGoogleIdentity: vi.fn().mockResolvedValue({
        user: makeUser({ email: 'gh_42@users.noreply.sambasku.local' }),
        identity: {
          id: '1',
          userId: '01TESTGITHUBUSER000000001',
          provider: 'github',
          providerUserId: '42',
          emailAtProvider: 'shared@email.com',
          createdAt: new Date(),
          deletedAt: null,
          deletedBy: null,
        },
        created: true,
      }),
    } as unknown as AuthIdentityRepository;

    const userRepo = {
      findByEmail: vi.fn().mockResolvedValue(makeUser({ email: 'shared@email.com' })),
      findByUsername: vi.fn().mockResolvedValue(null),
      findById: vi.fn(),
    } as unknown as UserRepository;

    const tokenService = {
      generateAccessToken: vi.fn().mockResolvedValue('jwt-gh'),
      verifyAccessToken: vi.fn(),
    } as unknown as TokenServicePort;

    const refreshTokenRepo = {
      create: vi.fn().mockResolvedValue({}),
    } as unknown as RefreshTokenRepository;

    const auditRepo = { record: vi.fn() } as unknown as AuditLogRepository;

    const useCase = new LoginWithGithubUseCase(
      userRepo,
      identityRepo,
      verifier,
      tokenService,
      refreshTokenRepo,
      auditRepo,
      900,
      2592000,
    );

    await useCase.execute({ accessToken: 'gho_x' });

    expect(identityRepo.createUserWithGoogleIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'gh_42@users.noreply.sambasku.local',
        username: 'octocat',
        displayName: 'The Octocat',
      }),
      expect.objectContaining({
        provider: 'github',
        providerUserId: '42',
        emailAtProvider: 'shared@email.com',
      }),
    );
  });
});
