/**
 * Port transport email - satu impl per provider (resend, brevo, ...).
 * Level transport saja: tanpa logika konten, tanpa quota, tanpa log.
 * Routing + quota + log ditangani QuotaAwareMailer.
 */
export interface EmailSendPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Attachment inline (logo brand via CID). */
  inlineLogo?: {
    content: string; // base64
    filename: string;
    mime: string;
    contentId: string;
  };
}

export interface EmailSendResult {
  messageId: string | null;
}

export interface EmailSenderPort {
  readonly provider: string;
  /** false = provider dilewati routing (key belum di-set, dsb). */
  isConfigured(): boolean;
  /**
   * Lempar Error gagal kirim. `err.status` di-set sender:
   * - 4xx selain 429 = kesalahan request/penerima - JANGAN di-failover.
   * - 429/5xx/network/timeout = sementara - boleh failover.
   */
  send(payload: EmailSendPayload): Promise<EmailSendResult>;
}
