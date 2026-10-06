import { env } from '@/shared/config/env';
import { logger } from '@/shared/logging/logger';
import { DEFAULT_MAIL_FROM } from '@/modules/auth/infrastructure/otp-email';
import type {
  EmailSendPayload,
  EmailSendResult,
  EmailSenderPort,
} from '../application/ports/email-sender.port';

/**
 * Provider Resend - ekstraksi HTTP call dari ResendMailerService lama.
 * Tanpa dependency SDK; fetch murni (Workers-safe).
 * Tanpa RESEND_API_KEY: isConfigured() false → provider dilewati routing.
 */
export class ResendEmailSender implements EmailSenderPort {
  readonly provider = 'resend';

  isConfigured(): boolean {
    return Boolean(env.RESEND_API_KEY);
  }

  async send(payload: EmailSendPayload): Promise<EmailSendResult> {
    const body: Record<string, unknown> = {
      from: env.MAIL_FROM?.trim() || DEFAULT_MAIL_FROM,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
    };
    if (payload.html) body.html = payload.html;
    if (payload.inlineLogo) {
      body.attachments = [
        {
          content: payload.inlineLogo.content,
          filename: payload.inlineLogo.filename,
          content_type: payload.inlineLogo.mime,
          content_id: payload.inlineLogo.contentId,
        },
      ];
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY ?? ''}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.warn(
        { status: res.status, body: text.slice(0, 500), to: payload.to },
        'resend email send failed',
      );
      const err = new Error(`Resend gagal (HTTP ${res.status}): ${text.slice(0, 300)}`) as Error & {
        status?: number;
      };
      err.status = res.status;
      throw err;
    }

    const data = (await res.json().catch(() => null)) as { id?: string } | null;
    return { messageId: data?.id ?? null };
  }
}
