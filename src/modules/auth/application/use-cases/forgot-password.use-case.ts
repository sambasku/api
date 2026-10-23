import { BadRequestError } from '@/shared/errors/app-error';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { PasswordResetTokenRepository } from '../../domain/repositories/password-reset-token.repository';
import type { AuthIdentityRepository } from '../../domain/repositories/auth-identity.repository';
import type { ForgotPasswordDto } from '../dto/reset-password.dto';
import type { MailerPort } from '../ports/mailer.port';
import { generateToken } from '../utils/token';
import { formatOtpDisplay, generateOtpCode, hashOtp, OTP_TTL_MS } from '../utils/otp';
import { isSyntheticOauthEmail } from '../utils/username-slug';

const RESET_LINK_TTL_MS = 60 * 60 * 1000; // tautan cadangan 1 jam

/** Label provider OAuth buat pesan user (bukan kode internal). */
const OAUTH_PROVIDER_LABEL: Record<string, string> = {
  google: 'Google',
  facebook: 'Facebook',
  github: 'GitHub',
};

export class ForgotPasswordUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly resetTokenRepo: PasswordResetTokenRepository,
    private readonly mailer: MailerPort,
    private readonly resetUrlBase: string,
    private readonly identityRepo?: AuthIdentityRepository,
  ) {}

  /**
   * Response tetap sama untuk email terdaftar atau tidak - cegah enumeration.
   * Pengecualian: akun OAuth-only dikasih tahu, karena di situ tidak ada
   * email yang bisa dikirim dan user butuh tahu harus lewat provider.
   */
  async execute(dto: ForgotPasswordDto): Promise<void> {
    // Normalisasi sama seperti register (Email.create): trim + lowercase,
    // supaya lookup kapital/varian tetap match ke user tersimpan.
    const user = await this.userRepo.findByEmail(dto.email.trim().toLowerCase());
    if (!user || user.deletedAt) return;

    // OAuth-only: tidak ada password untuk direset. Kasih tahu user provider
    // mana yang dipakai supaya dia tahu harus lewat situ.
    if (!user.passwordHash) {
      if (isSyntheticOauthEmail(user.email)) return; // email sintetis = tidak ada yang bisa dikasih tahu
      const provider = await this.oauthProviderOf(user.id);
      if (provider) {
        const label = OAUTH_PROVIDER_LABEL[provider] ?? provider;
        throw new BadRequestError(
          'OAUTH_ACCOUNT',
          `Akun kamu login dengan layanan OAuth ${label}, reset password tidak bisa diproses di sini. Masuk pakai ${label} dulu, lalu atur password dari Profil.`,
        );
      }
      return;
    }

    await this.resetTokenRepo.invalidateUnusedForUser(user.id);

    const code = generateOtpCode();
    await this.resetTokenRepo.create({
      userId: user.id,
      tokenHash: hashOtp(user.id, code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });

    const { token, tokenHash } = generateToken();
    await this.resetTokenRepo.create({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_LINK_TTL_MS),
    });

    await this.mailer.sendResetPasswordEmail(
      user.email,
      `${this.resetUrlBase}?token=${token}`,
      formatOtpDisplay(code),
    );
  }

  /** Provider OAuth yang tertaut ke user (google/facebook/github), null kalau tidak ada. */
  private async oauthProviderOf(userId: string): Promise<string | null> {
    if (!this.identityRepo) return null;
    const identities = await this.identityRepo.listActiveByUserId(userId);
    const known = identities.find((i) => i.provider in OAUTH_PROVIDER_LABEL);
    return known?.provider ?? null;
  }
}
