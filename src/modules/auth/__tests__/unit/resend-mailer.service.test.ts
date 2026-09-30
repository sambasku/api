import { afterEach, describe, expect, it, vi } from 'vitest';

const { envState } = vi.hoisted(() => ({
  envState: {
    NODE_ENV: 'staging' as string,
    RESEND_API_KEY: 're_test_key' as string | undefined,
    MAIL_FROM: undefined as string | undefined,
  },
}));

vi.mock('@/shared/config/env', () => ({
  env: envState,
}));

vi.mock('@/shared/logging/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import { ResendMailerService } from '../../infrastructure/resend-mailer.service';

describe('ResendMailerService', () => {
  afterEach(() => {
    envState.NODE_ENV = 'staging';
    envState.RESEND_API_KEY = 're_test_key';
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('staging: tidak memanggil Resend meski API key ada', async () => {
    envState.NODE_ENV = 'staging';
    envState.RESEND_API_KEY = 're_test_key';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const mailer = new ResendMailerService();
    await mailer.sendVerificationOtpEmail('user@example.com', '111-111');

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
