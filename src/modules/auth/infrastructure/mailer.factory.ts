import type { MailerPort } from '../application/ports/mailer.port';
import { QuotaAwareMailer } from '@/modules/email/infrastructure/quota-aware-mailer';
import { ResendEmailSender } from '@/modules/email/infrastructure/resend-email.sender';

// Interface deps dibuat opsional biar pemanggil lama (app.ts) tak berubah;
// repositori email wajib ada supaya quota+log jalan di SEMUA tier.
export interface CreateMailerEmailDeps {
  quotaRepo: import('@/modules/email/domain/repositories/email.repository').EmailQuotaRepository;
  usageRepo: import('@/modules/email/domain/repositories/email.repository').EmailUsageRepository;
  logRepo: import('@/modules/email/domain/repositories/email.repository').EmailLogRepository;
}

/**
 * Pilih impl MailerPort (Section 8 - ganti provider = ganti impl, use case
 * tidak tahu bedanya). Selalu QuotaAwareMailer: quota check + log di satu
 * titik untuk semua kirim email. Sender terpasang: resend (brevo, mailjet,
 * ... tinggal ditambah ke daftar + seed email_quotas).
 *
 * Tanpa deps email (test lama): fallback SmtpMailerService perilaku lama.
 */
export function createMailer(emailDeps?: CreateMailerEmailDeps): MailerPort {
  if (emailDeps) {
    return new QuotaAwareMailer([{ sender: new ResendEmailSender() }], emailDeps.quotaRepo, emailDeps.usageRepo, emailDeps.logRepo);
  }
  // ponytail: jalur fallback hanya dipakai test/unit lama; production app.ts selalu kasih deps.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { SmtpMailerService } = require('./smtp-mailer.service') as typeof import('./smtp-mailer.service');
  return new SmtpMailerService();
}
