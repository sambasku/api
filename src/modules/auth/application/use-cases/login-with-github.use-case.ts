import { UnauthorizedError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import { Email } from '../../domain/value-objects/email.vo';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { AuthIdentityRepository } from '../../domain/repositories/auth-identity.repository';
import type { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository';
import type { User } from '../../domain/entities/user.entity';
import type { AuthIdentity } from '../../domain/entities/auth-identity.entity';
import type { LoginMeta } from '../dto/login.dto';
import type { GithubLoginDto } from '../dto/github-login.dto';
import type { GithubTokenVerifierPort } from '../ports/github-token-verifier.port';
import type { TokenServicePort } from '../ports/token-service.port';
import { issueLoginSession, type LoginResult } from '../utils/issue-login-session';
import { allocateUniqueUsername, syntheticOauthEmail } from '../utils/username-slug';

const GITHUB_PROVIDER = 'github';
const INVALID_MESSAGE = 'Tidak bisa masuk dengan GitHub.';

function invalidGithubToken(): UnauthorizedError {
  return new UnauthorizedError('INVALID_GITHUB_TOKEN', INVALID_MESSAGE);
}

export class LoginWithGithubUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly identityRepo: AuthIdentityRepository,
    private readonly verifier: GithubTokenVerifierPort,
    private readonly tokenService: TokenServicePort,
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly accessTokenTtlSeconds: number,
    private readonly refreshTokenTtlSeconds: number,
  ) {}

  async execute(dto: GithubLoginDto, meta: LoginMeta = {}, requestId?: string | null): Promise<LoginResult> {
    const claims = await this.verifier.verify(dto.accessToken);

    const identity = await this.identityRepo.findByProvider(GITHUB_PROVIDER, claims.id);
    if (identity) {
      return this.sessionForExistingIdentity(identity, meta);
    }

    let providerEmail: string | null = null;
    if (claims.email) {
      try {
        providerEmail = Email.create(claims.email).value;
      } catch {
        providerEmail = null;
      }
    }

    let email: string;
    if (providerEmail) {
      const taken = await this.userRepo.findByEmail(providerEmail);
      email = taken ? syntheticOauthEmail('github', claims.id) : providerEmail;
    } else {
      email = syntheticOauthEmail('github', claims.id);
    }

    const displayName = (claims.name?.trim() || claims.login || 'Pengguna').slice(0, 100);
    const username = await allocateUniqueUsername(
      (u) => this.userRepo.findByUsername(u),
      claims.login,
      providerEmail,
      'github',
    );

    const created = await this.identityRepo.createUserWithGoogleIdentity(
      {
        username,
        displayName,
        email,
        phone: null,
        passwordHash: null,
        emailVerified: true,
      },
      {
        provider: GITHUB_PROVIDER,
        providerUserId: claims.id,
        emailAtProvider: providerEmail,
      },
    );

    if (!created.created) {
      return this.sessionForExistingIdentity(created.identity, meta, created.user);
    }

    await this.auditRepo.record({
      userId: created.user.id,
      action: 'create',
      entityType: 'user',
      entityId: created.user.id,
      newData: {
        username: created.user.username,
        email: created.user.email,
        phone: null,
        role: created.user.role,
        via: 'github',
      },
      requestId: requestId ?? null,
    });

    return this.issue(created.user, meta);
  }

  private async sessionForExistingIdentity(
    identity: AuthIdentity,
    meta: LoginMeta,
    knownUser?: User,
  ): Promise<LoginResult> {
    if (identity.deletedAt) throw invalidGithubToken();
    const user = knownUser ?? (await this.userRepo.findById(identity.userId));
    if (!user || user.deletedAt || !user.isActive) throw invalidGithubToken();
    return this.issue(user, meta);
  }

  private issue(user: User, meta: LoginMeta): Promise<LoginResult> {
    return issueLoginSession(
      { id: user.id, username: user.username, displayName: user.displayName, roles: user.roles, avatarUrl: user.avatarUrl },
      {
        tokenService: this.tokenService,
        refreshTokenRepo: this.refreshTokenRepo,
        accessTokenTtlSeconds: this.accessTokenTtlSeconds,
        refreshTokenTtlSeconds: this.refreshTokenTtlSeconds,
      },
      meta,
    );
  }
}
