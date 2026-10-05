import { logger } from '@/shared/logging/logger';
import { ServiceUnavailableError } from '@/shared/errors/app-error';
import type { MailerPort } from '@/modules/auth/application/ports/mailer.port';
import { rememberOtp } from '@/modules/auth/infrastructure/otp-capture';
import {
  accountDeletionEmailHtml,
  accountDeletionEmailText,
} from '@/modules/auth/infrastructure/account-deletion-email';
import {
  verifierApprovedEmailHtml,
  verifierApprovedEmailText,
} from '@/modules/auth/infrastructure/verifier-approved-email';
import { otpEmailHtml, otpEmailText } from '@/modules/auth/infrastructure/otp-email';
import {
  OTP_EMAIL_LOGO_BASE64,
  OTP_EMAIL_LOGO_CONTENT_ID,
  OTP_EMAIL_LOGO_FILENAME,
  OTP_EMAIL_LOGO_MIME,
} from '@/modules/auth/infrastructure/otp-email-logo';
import {
  resetPasswordEmailHtml,
  resetPasswordEmailText,
} from '@/modules/auth/infrastructure/reset-password-email';
import type { EmailQuotaWithUsage } from '../domain/entities/email.entity';
import type {
  EmailLogRepository,
  EmailQuotaRepository,
  EmailUsageRepository,
} from '../domain/repositories/email.repository';
import type {
  EmailSendPayload,
  EmailSendResult,
  EmailSenderPort,
} from '../application/ports/email-sender.port';

export interface EmailRoutingEntry {
  sender: EmailSenderPort;
}

/** Status kirim per attempt - dipakai use-case test untuk laporan. */
export interface EmailSendOutcome {
  sent: boolean;
  provider: string | null;
  messageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

const SKIP_ERROR = 'EMAIL_QUOTA_EXCEEDED';

/** Logo brand inline (CID) - dipakai semua kategori email. */
const EMAIL_LOGO = {
  content: OTP_EMAIL_LOGO_BASE64,
  filename: OTP_EMAIL_LOGO_FILENAME,
  mime: OTP_EMAIL_LOGO_MIME,
  contentId: OTP_EMAIL_LOGO_CONTENT_ID,
};

/**
 * MailerPort yang routing antar-provider dengan quota check + log.
 * Pattern multi-provider: daftar sender urut prioritas; provider
 * nonaktif/tanpa key/tanpa baris quota dilewati. Quota habis → failover;
 * 4xx (penerima/request salah) TIDAK failover.
 *
 * catatan implementasi mengikuti SendWaMessageUseCase (modul wa).
 */
export class QuotaAwareMailer implements MailerPort {
  constructor(
    private readonly senders: EmailRoutingEntry[],
    private readonly quotaRepo: EmailQuotaRepository,
    private readonly usageRepo: EmailUsageRepository,
    private readonly logRepo: EmailLogRepository,
  ) {}

  async sendResetPasswordEmail(to: string, resetUrl: string, displayCode: string): Promise<void> {
    await this.send(
      { to, subject: 'Reset password - SambasKu', text: resetPasswordEmailText(displayCode), html: resetPasswordEmailHtml(displayCode), inlineLogo: EMAIL_LOGO },
      'reset_password',
    );
  }

  async sendAccountDeletionEmail(to: string, displayCode: string, pageUrl: string): Promise<void> {
    rememberOtp(to, displayCode);
    await this.send(
      { to, subject: 'Kode hapus akun - SambasKu', text: accountDeletionEmailText(displayCode, pageUrl), html: accountDeletionEmailHtml(displayCode, pageUrl), inlineLogo: EMAIL_LOGO },
      'account_deletion',
    );
  }

  async sendVerifierApprovedEmail(to: string, displayName: string): Promise<void> {
    await this.send(
      { to, subject: 'Selamat menjadi Verifikator - SambasKu', text: verifierApprovedEmailText(displayName), html: verifierApprovedEmailHtml(displayName), inlineLogo: EMAIL_LOGO },
      'verifier_approved',
    );
  }

  async sendVerificationOtpEmail(to: string, displayCode: string): Promise<void> {
    rememberOtp(to, displayCode);
    await this.send(
      { to, subject: 'Kode verifikasi - SambasKu', text: otpEmailText(displayCode), html: otpEmailHtml(displayCode), inlineLogo: EMAIL_LOGO },
      'otp',
    );
  }

  /**
   * Kirim email test dari playground admin. Provider boleh dipilih;
   * tetap lewat quota check + log (category 'test').
   */
  async sendTest(
    to: string,
    provider?: string,
  ): Promise<EmailSendOutcome> {
    return this.send(
      {
        to,
        subject: 'Email test - SambasKu',
        text: 'Ini email test dari Console SambasKu. Kalau kamu menerimanya, pengiriman email berjalan normal.',
        html: `<p>Ini email test dari Console SambasKu. Kalau kamu menerimanya, pengiriman email berjalan normal.</p><p style="color:#6b7280;font-size:12px">Dikirim otomatis, mohon abaikan.</p>`,
        inlineLogo: EMAIL_LOGO,
      },
      'test',
      provider,
    );
  }

  private async send(
    payload: EmailSendPayload,
    category: Parameters<EmailLogRepository['record']>[0]['category'],
    providerFilter?: string,
  ): Promise<EmailSendOutcome> {
    const candidates = await this.resolveCandidates(providerFilter);
    // Staging: tidak ada kirim nyata (perilaku lama ResendMailerService).
    if (process.env.NODE_ENV === 'staging') {
      await this.safeLog({
        provider: candidates[0]?.sender.provider ?? 'none',
        category,
        toEmail: payload.to,
        status: 'skipped_env',
        errorMessage: 'STAGING: email tidak dikirim',
      });
      return { sent: true, provider: null, messageId: null, errorCode: null, errorMessage: 'skipped_env' };
    }

    if (candidates.length === 0) {
      await this.safeLog({
        provider: providerFilter ?? 'none',
        category,
        toEmail: payload.to,
        status: 'failed',
        errorCode: SKIP_ERROR,
        errorMessage: 'Tidak ada provider email terkonfigurasi',
      });
      throw new ServiceUnavailableError(
        SKIP_ERROR,
        'Layanan email sedang tidak tersedia. Coba lagi sebentar.',
      );
    }

    let lastErrorCode: string | null = null;
    let lastErrorMessage: string | null = null;
    let skipped = 0;

    for (const { sender } of candidates) {
      // Quota check bulan + hari. Repo error → anggap habis (fail-closed).
      let quota: EmailQuotaWithUsage | null = null;
      try {
        quota = await this.quotaRepo.getOne(sender.provider, new Date());
      } catch (err) {
        logger.warn({ err, provider: sender.provider }, 'email quota check gagal');
      }
      if (!quota || !quota.active) {
        lastErrorMessage = `Provider ${sender.provider} tidak aktif / tidak terdaftar`;
        continue;
      }
      const monthUsed = quota.apiMonthUsed + quota.manualUsedEffective;
      if (monthUsed >= quota.monthlyLimit || quota.todayUsed >= quota.dailyLimit) {
        lastErrorCode = SKIP_ERROR;
        lastErrorMessage = `Kuota ${sender.provider} habis (bulan ${monthUsed}/${quota.monthlyLimit}, hari ${quota.todayUsed}/${quota.dailyLimit})`;
        await this.safeLog({
          provider: sender.provider,
          category,
          toEmail: payload.to,
          status: 'skipped_quota',
          errorCode: SKIP_ERROR,
          errorMessage: lastErrorMessage,
        });
        skipped += 1;
        continue;
      }

      try {
        const result: EmailSendResult = await sender.send(payload);
        // Kirim sukses → increment + log best-effort (jangan gagalkan response).
        await this.safeUsage(sender.provider);
        await this.safeLog({
          provider: sender.provider,
          category,
          toEmail: payload.to,
          status: 'sent',
          providerMessageId: result.messageId,
        });
        return { sent: true, provider: sender.provider, messageId: result.messageId, errorCode: null, errorMessage: null };
      } catch (err) {
        const status = (err as Error & { status?: number }).status;
        const message = err instanceof Error ? err.message : String(err);
        await this.safeLog({
          provider: sender.provider,
          category,
          toEmail: payload.to,
          status: 'failed',
          errorCode: status ? `PROVIDER_${status}` : 'PROVIDER_ERROR',
          errorMessage: message.slice(0, 500),
        });
        // 4xx selain 429 = penerima/request salah; provider lain pasti gagal juga.
        if (status && status >= 400 && status < 500 && status !== 429) {
          return { sent: false, provider: sender.provider, messageId: null, errorCode: `PROVIDER_${status}`, errorMessage: message };
        }
        lastErrorCode = status ? `PROVIDER_${status}` : 'PROVIDER_ERROR';
        lastErrorMessage = message;
        continue;
      }
    }

    if (lastErrorCode === SKIP_ERROR || skipped === candidates.length) {
      throw new ServiceUnavailableError(
        SKIP_ERROR,
        'Kuota email habis. Coba lagi nanti atau hubungi admin.',
      );
    }
    throw new ServiceUnavailableError(
      'EMAIL_SEND_FAILED',
      lastErrorMessage ?? 'Gagal mengirim email. Coba lagi sebentar.',
    );
  }

  private async resolveCandidates(providerFilter?: string): Promise<EmailRoutingEntry[]> {
    const configured = this.senders.filter((e) => e.sender.isConfigured());
    if (providerFilter) {
      return configured.filter((e) => e.sender.provider === providerFilter);
    }
    // Urutan failover = priority ASC dari email_quotas; provider tanpa
    // baris quota tetap dicoba di ekor (quota check nanti menahan).
    let order: string[] = [];
    try {
      const rows = await this.quotaRepo.listWithUsage(new Date());
      order = rows.map((r) => r.provider);
    } catch (err) {
      logger.warn({ err }, 'email quota list gagal - pakai urutan default');
    }
    return [...configured].sort(
      (a, b) => order.indexOf(a.sender.provider) - order.indexOf(b.sender.provider),
    );
  }

  private async safeUsage(provider: string): Promise<void> {
    try {
      await this.usageRepo.increment(provider, new Date());
    } catch (err) {
      logger.error({ err, provider }, 'email usage increment gagal (email sudah terkirim)');
    }
  }

  private async safeLog(entry: Parameters<EmailLogRepository['record']>[0]): Promise<void> {
    try {
      await this.logRepo.record(entry);
    } catch (err) {
      logger.error({ err, provider: entry.provider, status: entry.status }, 'email log write gagal');
    }
  }
}
