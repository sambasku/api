import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '@/shared/errors/app-error';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { AuthIdentityRepository } from '../../domain/repositories/auth-identity.repository';
import type { GithubTokenVerifierPort } from '../ports/github-token-verifier.port';
import type { AuthIdentity } from '../../domain/entities/auth-identity.entity';

const GITHUB_PROVIDER = 'github';

export class LinkGithubAccountUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly identityRepo: AuthIdentityRepository,
    private readonly verifier: GithubTokenVerifierPort,
  ) {}

  async execute(userId: string, accessToken: string): Promise<AuthIdentity> {
    const user = await this.userRepo.findById(userId);
    if (!user || user.deletedAt || !user.isActive) {
      throw new UnauthorizedError('UNAUTHORIZED', 'Sesi tidak valid');
    }

    const claims = await this.verifier.verify(accessToken);
    return this.identityRepo.link(userId, {
      provider: GITHUB_PROVIDER,
      providerUserId: claims.id,
      emailAtProvider: claims.email,
    });
  }
}

export class UnlinkGithubAccountUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly identityRepo: AuthIdentityRepository,
  ) {}

  async execute(userId: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user || user.deletedAt || !user.isActive) {
      throw new UnauthorizedError('UNAUTHORIZED', 'Sesi tidak valid');
    }

    const active = await this.identityRepo.findActiveByUserAndProvider(userId, GITHUB_PROVIDER);
    if (!active) {
      throw new NotFoundError('GITHUB_NOT_LINKED', 'Akun GitHub belum terhubung.');
    }

    const allActive = await this.identityRepo.listActiveByUserId(userId);
    const hasPassword = user.passwordHash !== null;
    const otherIdentities = allActive.filter((i) => i.provider !== GITHUB_PROVIDER);
    if (!hasPassword && otherIdentities.length === 0) {
      throw new ConflictError(
        'LAST_AUTH_METHOD',
        'Setel password dulu sebelum melepas GitHub. Gunakan lupa password jika belum punya.',
      );
    }

    await this.identityRepo.unlink(userId, GITHUB_PROVIDER, userId);
  }
}
