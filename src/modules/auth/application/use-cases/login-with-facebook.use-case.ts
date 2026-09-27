import { UnauthorizedError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import { Email } from '../../domain/value-objects/email.vo';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { AuthIdentityRepository } from '../../domain/repositories/auth-identity.repository';
import type { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository';
import type { User } from '../../domain/entities/user.entity';
import type { AuthIdentity } from '../../domain/entities/auth-identity.entity';
import type { LoginMeta } from '../dto/login.dto';
import type { FacebookLoginDto } from '../dto/facebook-login.dto';
import type { FacebookTokenVerifierPort } from '../ports/facebook-token-verifier.port';
import type { TokenServicePort } from '../ports/token-service.port';
import { issueLoginSession, type LoginResult } from '../utils/issue-login-session';
import { allocateUniqueUsername, syntheticOauthEmail } from '../utils/username-slug';

const FACEBOOK_PROVIDER = 'facebook';
const INVALID_MESSAGE = 'Tidak bisa masuk dengan Facebook.';

function invalidFacebookToken(): UnauthorizedError {
  return new UnauthorizedError('INVALID_FACEBOOK_TOKEN', INVALID_MESSAGE);
}

export class LoginWithFacebookUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly identityRepo: AuthIdentityRepository,
    private readonly verifier: FacebookTokenVerifierPort,
    private readonly tokenService: TokenServicePort,
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly accessTokenTtlSeconds: number,
    private readonly refreshTokenTtlSeconds: number,
  ) {}

  async execute(dto: FacebookLoginDto, meta: LoginMeta = {}, requestId?: string | null): Promise<LoginResult> {
    const claims = await this.verifier.verify(dto.accessToken);
    const providerEmail = Email.create(claims.email).value;

    const identity = await this.identityRepo.findByProvider(FACEBOOK_PROVIDER, claims.facebookUserId);
    if (identity) {
      return this.sessionForExistingIdentity(identity, meta);
    }

    const emailTaken = await this.userRepo.findByEmail(providerEmail);
    const email = emailTaken
      ? syntheticOauthEmail('facebook', claims.facebookUserId)
      : providerEmail;

    const displayName = (claims.name?.trim() || providerEmail.split('@')[0] || 'Pengguna').slice(0, 100);
    const username = await allocateUniqueUsername(
      (u) => this.userRepo.findByUsername(u),
      claims.name,
      providerEmail,
      'facebook',
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
        provider: FACEBOOK_PROVIDER,
        providerUserId: claims.facebookUserId,
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
        via: 'facebook',
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
    if (identity.deletedAt) throw invalidFacebookToken();
    const user = knownUser ?? (await this.userRepo.findById(identity.userId));
    if (!user || user.deletedAt || !user.isActive) throw invalidFacebookToken();
    return this.issue(user, meta);
  }

  private issue(user: User, meta: LoginMeta): Promise<LoginResult> {
    return issueLoginSession(
      { id: user.id, username: user.username, displayName: user.displayName, role: user.role, avatarUrl: user.avatarUrl },
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
