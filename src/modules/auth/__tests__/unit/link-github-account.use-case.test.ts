import { describe, it, expect, vi } from 'vitest';
import { ConflictError, NotFoundError, UnauthorizedError } from '@/shared/errors/app-error';
import {
  LinkGithubAccountUseCase,
  UnlinkGithubAccountUseCase,
} from '../../application/use-cases/link-github-account.use-case';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { AuthIdentityRepository } from '../../domain/repositories/auth-identity.repository';
import type { GithubTokenVerifierPort } from '../../application/ports/github-token-verifier.port';
import type { User } from '../../domain/entities/user.entity';
import type { AuthIdentity } from '../../domain/entities/auth-identity.entity';

const USER_ID = '01TESTLINKGHUSER0000000001';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: USER_ID,
    username: 'budi',
    displayName: 'budi',
    bio: null,
    email: 'budi@test.com',
    phone: null,
    passwordHash: 'hash',
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
    ...overrides,
  };
}

function makeIdentity(overrides: Partial<AuthIdentity> = {}): AuthIdentity {
  return {
    id: '01TESTLINKGHIDENT000000001',
    userId: USER_ID,
    provider: 'github',
    providerUserId: '12345',
    emailAtProvider: 'octocat@github.com',
    createdAt: new Date('2026-09-01T00:00:00Z'),
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  };
}

describe('LinkGithubAccountUseCase', () => {
  it('memverifikasi token lalu link', async () => {
    const identity = makeIdentity();
    const userRepo = { findById: vi.fn().mockResolvedValue(makeUser()) } as unknown as UserRepository;
    const identityRepo = { link: vi.fn().mockResolvedValue(identity) } as unknown as AuthIdentityRepository;
    const verifier = {
      verify: vi.fn().mockResolvedValue({
        id: '12345',
        login: 'octocat',
        name: 'The Octocat',
        email: 'octocat@github.com',
        avatarUrl: null,
      }),
    } as unknown as GithubTokenVerifierPort;

    const result = await new LinkGithubAccountUseCase(userRepo, identityRepo, verifier).execute(
      USER_ID,
      'gho_token',
    );

    expect(verifier.verify).toHaveBeenCalledWith('gho_token');
    expect(identityRepo.link).toHaveBeenCalledWith(USER_ID, {
      provider: 'github',
      providerUserId: '12345',
      emailAtProvider: 'octocat@github.com',
    });
    expect(result).toBe(identity);
  });

  it('sesi invalid → UNAUTHORIZED', async () => {
    const userRepo = { findById: vi.fn().mockResolvedValue(null) } as unknown as UserRepository;
    const identityRepo = { link: vi.fn() } as unknown as AuthIdentityRepository;
    const verifier = { verify: vi.fn() } as unknown as GithubTokenVerifierPort;

    await expect(
      new LinkGithubAccountUseCase(userRepo, identityRepo, verifier).execute(USER_ID, 't'),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(verifier.verify).not.toHaveBeenCalled();
  });
});

describe('UnlinkGithubAccountUseCase', () => {
  it('lepas GitHub jika ada password', async () => {
    const identity = makeIdentity();
    const userRepo = { findById: vi.fn().mockResolvedValue(makeUser()) } as unknown as UserRepository;
    const identityRepo = {
      findActiveByUserAndProvider: vi.fn().mockResolvedValue(identity),
      listActiveByUserId: vi.fn().mockResolvedValue([identity]),
      unlink: vi.fn().mockResolvedValue(identity),
    } as unknown as AuthIdentityRepository;

    await new UnlinkGithubAccountUseCase(userRepo, identityRepo).execute(USER_ID);

    expect(identityRepo.unlink).toHaveBeenCalledWith(USER_ID, 'github', USER_ID);
  });

  it('OAuth-only tanpa metode lain → LAST_AUTH_METHOD', async () => {
    const identity = makeIdentity();
    const userRepo = {
      findById: vi.fn().mockResolvedValue(makeUser({ passwordHash: null })),
    } as unknown as UserRepository;
    const identityRepo = {
      findActiveByUserAndProvider: vi.fn().mockResolvedValue(identity),
      listActiveByUserId: vi.fn().mockResolvedValue([identity]),
      unlink: vi.fn(),
    } as unknown as AuthIdentityRepository;

    await expect(new UnlinkGithubAccountUseCase(userRepo, identityRepo).execute(USER_ID)).rejects.toMatchObject({
      errorCode: 'LAST_AUTH_METHOD',
    });
    expect(identityRepo.unlink).not.toHaveBeenCalled();
  });

  it('belum terhubung → GITHUB_NOT_LINKED', async () => {
    const userRepo = { findById: vi.fn().mockResolvedValue(makeUser()) } as unknown as UserRepository;
    const identityRepo = {
      findActiveByUserAndProvider: vi.fn().mockResolvedValue(null),
      listActiveByUserId: vi.fn(),
      unlink: vi.fn(),
    } as unknown as AuthIdentityRepository;

    await expect(new UnlinkGithubAccountUseCase(userRepo, identityRepo).execute(USER_ID)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('ConflictError GITHUB_ALREADY_LINKED', () => {
  it('repo link melempar conflict diteruskan', async () => {
    const userRepo = { findById: vi.fn().mockResolvedValue(makeUser()) } as unknown as UserRepository;
    const identityRepo = {
      link: vi.fn().mockRejectedValue(
        new ConflictError('GITHUB_ALREADY_LINKED', 'Akun GitHub ini sudah terhubung ke pengguna lain.'),
      ),
    } as unknown as AuthIdentityRepository;
    const verifier = {
      verify: vi.fn().mockResolvedValue({
        id: '1',
        login: 'x',
        name: null,
        email: null,
        avatarUrl: null,
      }),
    } as unknown as GithubTokenVerifierPort;

    await expect(
      new LinkGithubAccountUseCase(userRepo, identityRepo, verifier).execute(USER_ID, 't'),
    ).rejects.toMatchObject({ errorCode: 'GITHUB_ALREADY_LINKED' });
  });
});
