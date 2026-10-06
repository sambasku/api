import type { SendWaMessageCommand, SendWaMessageResult } from './send-wa-message.use-case';

/**
 * Notifikasi WA ke pemohon verifikator. Dipanggil dari approve/reject
 * use-case setelah keputusan tersimpan - gagal kirim TIDAK membatalkan
 * keputusan (pola sama sendWelcomeEmail).
 */
export interface SendVerifierWaCommand {
  userId: string;
  phone: string | null;
  eventKey: 'verifier_application_approved' | 'verifier_application_rejected';
  displayName: string;
  /** Approved: manfaat jadi verifikator. Rejected: alasan penolakan. */
  detail: string;
  ctaUrl: string;
}

export class SendVerifierWaNotificationUseCase {
  constructor(private readonly sendWa: { execute(cmd: SendWaMessageCommand): Promise<SendWaMessageResult> }) {}

  async execute(cmd: SendVerifierWaCommand): Promise<void> {
    if (!cmd.phone) return;
    try {
      await this.sendWa.execute({
        eventKey: cmd.eventKey,
        toPhone: cmd.phone,
        channel: 'template',
        template: {
          eventKey: cmd.eventKey,
          params: {
            displayName: cmd.displayName,
            ...(cmd.eventKey === 'verifier_application_approved'
              ? { benefits: cmd.detail }
              : { reasonRejected: cmd.detail }),
            ctaUrl: cmd.ctaUrl,
          },
        },
      });
    } catch {
      // Quota habis / provider mati: keputusan sudah tersimpan, jangan gagalkan.
    }
  }
}
