import { describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/config/env', () => ({
  env: { NODE_ENV: 'production', RESEND_API_KEY: 're_test_key', MAIL_FROM: undefined },
}));

vi.mock('@/shared/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { QuotaAwareMailer } from '../../infrastructure/quota-aware-mailer';
import type { EmailQuotaWithUsage } from '../../domain/entities/email.entity';
import type {
  EmailLogRepository,
  EmailQuotaRepository,
  EmailUsageRepository,
} from '../../domain/repositories/email.repository';
import type {
  EmailSendPayload,
  EmailSenderPort,
} from '../../application/ports/email-sender.port';

/**
 * Regresi bug reset password: provider balas 4xx (mis. Resend 403 domain
 * belum verified) dulu-dulu hanya return outcome - forgot password tetap
 * 200 "kode terkirim" padahal email tidak keluar. send() WAJIB throw
 * ServiceUnavailableError supaya use case gagal keras.
 */

function quotaRow(over: Partial<EmailQuotaWithUsage> = {}): EmailQuotaWithUsage {
  return {
    provider: 'resend',
    monthlyLimit: 3000,
    dailyLimit: 100,
    manualMonthlyUsed: 0,
    manualUsedEffective: 0,
    priority: 1,
    active: true,
    apiMonthUsed: 0,
    todayUsed: 0,
    updatedAt: null,
    ...over,
  };
}

function senderThatThrows(status: number, provider = 'resend'): EmailSenderPort {
  return {
    provider,
    isConfigured: () => true,
    send: async (_payload: EmailSendPayload) => {
      const err = new Error(`Resend gagal (HTTP ${status})`) as Error & { status?: number };
      err.status = status;
      throw err;
    },
  };
}

function makeMailer(senders: EmailSenderPort[]) {
  const quotaRepo = {
    getOne: vi.fn().mockResolvedValue(quotaRow()),
    listWithUsage: vi.fn().mockResolvedValue([quotaRow()]),
  } as unknown as EmailQuotaRepository;
  const usageRepo = { increment: vi.fn() } as unknown as EmailUsageRepository;
  const logRepo = { record: vi.fn() } as unknown as EmailLogRepository;
  return {
    mailer: new QuotaAwareMailer(
      senders.map((sender) => ({ sender })),
      quotaRepo,
      usageRepo,
      logRepo,
    ),
    logRepo,
  };
}

describe('QuotaAwareMailer provider 4xx', () => {
  it.each([401, 403, 422])(
    'HTTP %s: throw ServiceUnavailableError (bukan silent return) - forgot password jangan 200 palsu',
    async (status) => {
      const { mailer } = makeMailer([senderThatThrows(status)]);
      await expect(mailer.sendTest('budi@test.com')).rejects.toThrow(/Resend gagal/);
    },
  );

  it('429 tetap failover ke provider berikutnya', async () => {
    const ok: EmailSenderPort = {
      provider: 'resend',
      isConfigured: () => true,
      send: async () => ({ messageId: 'id-2' }),
    };
    const { mailer } = makeMailer([senderThatThrows(429, 'resend'), ok]);
    const result = await mailer.sendTest('budi@test.com');
    expect(result.sent).toBe(true);
    expect(result.provider).toBe('resend');
  });
});
