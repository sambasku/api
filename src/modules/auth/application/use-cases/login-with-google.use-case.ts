import { UnauthorizedError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import { Email } from '../../domain/value-objects/email.vo';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { AuthIdentityRepository } from '../../domain/repositories/auth-identity.repository';
import type { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository';
import type { User } from '../../domain/entities/user.entity';
import type { AuthIdentity } from '../../domain/entities/auth-identity.entity';
import type { LoginMeta } from '../dto/login.dto';
import type { GoogleLoginDto } from '../dto/google-login.dto';
import type { ConsentInput } from '@/modules/legal/application/utils/validate-consents';
import type { GoogleTokenVerifierPort } from '../ports/google-token-verifier.port';
import type { TokenServicePort } from '../ports/token-service.port';
import { issueLoginSession, type LoginResult } from '../utils/issue-login-session';
import { SocialConsentService } from '../utils/social-consent';
import { buildUsernameCandidates, syntheticOauthEmail } from '../utils/username-slug';

const GOOGLE_PROVIDER = 'google';
const INVALID_MESSAGE = 'Tidak bisa masuk dengan Google.';

function invalidGoogleToken(): UnauthorizedError {
  return new UnauthorizedError('INVALID_GOOGLE_TOKEN', INVALID_MESSAGE);
}

export class LoginWithGoogleUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly identityRepo: AuthIdentityRepository,
    private readonly verifier: GoogleTokenVerifierPort,
    private readonly tokenService: TokenServicePort,
    private readonly refreshTokenRepo: RefreshTokenRepository,
  private readonly auditRepo: AuditLogRepository,
  private readonly consent: SocialConsentService,
  private readonly accessTokenTtlSeconds: number,
    private readonly refreshTokenTtlSeconds: number,
  ) {}

  async execute(dto: GoogleLoginDto, meta: LoginMeta = {}, requestId?: string | null): Promise<LoginResult> {
    const claims = await this.verifier.verify(dto.idToken);
    const providerEmail = Email.create(claims.email).value;

    const identity = await this.identityRepo.findByProvider(GOOGLE_PROVIDER, claims.sub);
    if (identity) {
      return this.sessionForExistingIdentity(identity, meta, dto.consents);
    }

    const emailTaken = await this.userRepo.findByEmail(providerEmail);
    const email = emailTaken
      ? syntheticOauthEmail('google', claims.sub)
      : providerEmail;

    // Consent gate SEBELUM akun dibuat: enforce menolak tanpa consents,
    // consents basi ditolak LEGAL_CONSENT_OUTDATED (lihat social-consent.ts).
    await this.consent.assertForNewUser(dto.consents);

    const displayName = (claims.name?.trim() || providerEmail.split('@')[0] || 'Pengguna').slice(0, 100);
    const usernameCandidates = buildUsernameCandidates(claims.name, providerEmail, 'google');

    const created = await this.identityRepo.createUserWithGoogleIdentity(
      {
        username: usernameCandidates[0],
        usernameCandidates,
        displayName,
        email,
        phone: null,
        passwordHash: null,
        emailVerified: true,
      },
      {
        provider: GOOGLE_PROVIDER,
        providerUserId: claims.sub,
        emailAtProvider: providerEmail,
      },
    );

    if (!created.created) {
      return this.sessionForExistingIdentity(created.identity, meta, dto.consents, created.user);
    }

    const { needsConsent } = await this.consent.recordForLogin(
      created.user.id,
      dto.consents,
      { clientId: meta.clientId, requestId: requestId ?? null },
    );

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
        via: 'google',
      },
      requestId: requestId ?? null,
    });

    const result = await this.issue(created.user, meta);
    return needsConsent ? { ...result, requiresConsent: true } : result;
  }

  private async sessionForExistingIdentity(
    identity: AuthIdentity,
    meta: LoginMeta,
    consents: ConsentInput[] | undefined,
    knownUser?: User,
  ): Promise<LoginResult> {
    if (identity.deletedAt) throw invalidGoogleToken();
    const user = knownUser ?? (await this.userRepo.findById(identity.userId));
    if (!user || user.deletedAt || !user.isActive) throw invalidGoogleToken();

    const { needsConsent } = await this.consent.recordForLogin(
      user.id,
      consents,
      { clientId: meta.clientId },
    );

    const result = await this.issue(user, meta);
    return needsConsent ? { ...result, requiresConsent: true } : result;
  }

  private async issue(user: User, meta: LoginMeta): Promise<LoginResult> {
    // Heal akun OAuth lama tanpa baris user_roles (sebelum fix create).
    let roles = user.roles;
    if (roles.length === 0) {
      await this.userRepo.setRoles(user.id, ['contributor']);
      roles = ['contributor'];
    }
    return issueLoginSession(
      {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        roles,
        avatarUrl: user.avatarUrl,
      },
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
