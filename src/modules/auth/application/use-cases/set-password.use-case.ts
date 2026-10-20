import { ConflictError, NotFoundError, UnauthorizedError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import { Password } from '../../domain/value-objects/password.vo';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { AuthIdentityRepository } from '../../domain/repositories/auth-identity.repository';
import type { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository';
import type { GoogleTokenVerifierPort } from '../ports/google-token-verifier.port';
import type { FacebookTokenVerifierPort } from '../ports/facebook-token-verifier.port';
import type { GithubTokenVerifierPort } from '../ports/github-token-verifier.port';
import type { PasswordHasherPort } from '../ports/password-hasher.port';
import type { SetPasswordDto, SetPasswordProvider } from '../dto/set-password.dto';
import { isSyntheticOauthEmail } from '../utils/username-slug';

const NOT_LINKED: Record<SetPasswordProvider, { code: string; message: string }> = {
  google: { code: 'GOOGLE_NOT_LINKED', message: 'Akun Google belum terhubung.' },
  facebook: { code: 'FACEBOOK_NOT_LINKED', message: 'Akun Facebook belum terhubung.' },
  github: { code: 'GITHUB_NOT_LINKED', message: 'Akun GitHub belum terhubung.' },
};

const INVALID: Record<SetPasswordProvider, { code: string; message: string }> = {
  google: { code: 'INVALID_GOOGLE_TOKEN', message: 'Tidak bisa masuk dengan Google.' },
  facebook: { code: 'INVALID_FACEBOOK_TOKEN', message: 'Tidak bisa masuk dengan Facebook.' },
  github: { code: 'INVALID_GITHUB_TOKEN', message: 'Tidak bisa masuk dengan GitHub.' },
};

export interface SetPasswordResult {
  message: string;
  loginWith: string;
}

/**
 * Isi password pertama kali untuk akun OAuth (hash null).
 * Bukti provider harus cocok dengan identity yang sudah tertaut ke user ini.
 */
export class SetPasswordUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly identityRepo: AuthIdentityRepository,
    private readonly hasher: PasswordHasherPort,
    private readonly auditRepo: AuditLogRepository,
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly googleVerifier: GoogleTokenVerifierPort,
    private readonly facebookVerifier: FacebookTokenVerifierPort,
    private readonly githubVerifier: GithubTokenVerifierPort,
  ) {}

  async execute(dto: SetPasswordDto, userId: string, requestId?: string | null): Promise<SetPasswordResult> {
    Password.create(dto.newPassword);

    const user = await this.userRepo.findById(userId);
    if (!user || user.deletedAt || !user.isActive) {
      throw new UnauthorizedError('UNAUTHORIZED', 'Sesi tidak valid');
    }
    if (user.passwordHash !== null) {
      throw new ConflictError(
        'PASSWORD_ALREADY_SET',
        'Akun ini sudah punya password. Gunakan ubah password.',
      );
    }

    const providerUserId = await this.prove(dto);
    const identity = await this.identityRepo.findActiveByUserAndProvider(userId, dto.provider);
    const missing = NOT_LINKED[dto.provider];
    if (!identity) {
      throw new NotFoundError(missing.code, missing.message);
    }
    if (identity.providerUserId !== providerUserId) {
      const invalid = INVALID[dto.provider];
      throw new UnauthorizedError(invalid.code, invalid.message);
    }

    await this.userRepo.updatePassword(userId, await this.hasher.hash(dto.newPassword));
    await this.refreshTokenRepo.revokeAllForUser(userId);
    await this.auditRepo.record({
      userId,
      action: 'password_change',
      entityType: 'user',
      entityId: userId,
      newData: { changed: true, via: 'set_password', provider: dto.provider },
      requestId: requestId ?? null,
    });

    const loginWith = isSyntheticOauthEmail(user.email) ? user.username : user.email;
    return {
      message: 'Password dibuat. Login lagi ya.',
      loginWith,
    };
  }

  private async prove(dto: SetPasswordDto): Promise<string> {
    if (dto.provider === 'google') {
      const claims = await this.googleVerifier.verify(dto.idToken ?? '');
      return claims.sub;
    }
    if (dto.provider === 'facebook') {
      const claims = await this.facebookVerifier.verify(dto.accessToken ?? '');
      return claims.facebookUserId;
    }
    const claims = await this.githubVerifier.verify(dto.accessToken ?? '');
    return claims.id;
  }
}
