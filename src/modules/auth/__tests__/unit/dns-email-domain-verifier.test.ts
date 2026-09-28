import { describe, it, expect, vi, afterEach } from 'vitest';
import { ValidationError } from '@/shared/errors/app-error';
import { DnsEmailDomainVerifier } from '../../infrastructure/dns-email-domain-verifier';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/dns-json' },
  });
}

describe('DnsEmailDomainVerifier', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('MX ada → ok tanpa query A', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        Status: 0,
        Answer: [{ type: 15, data: '10 mail.example.com.' }],
      }),
    );
    const verifier = new DnsEmailDomainVerifier(fetchFn);

    await expect(verifier.assertReachable('example.com')).resolves.toBeUndefined();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(String(fetchFn.mock.calls[0]![0])).toContain('type=MX');
  });

  it('tanpa MX tapi ada A → ok', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ Status: 0, Answer: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          Status: 0,
          Answer: [{ type: 1, data: '93.184.216.34' }],
        }),
      );
    const verifier = new DnsEmailDomainVerifier(fetchFn);

    await expect(verifier.assertReachable('example.com')).resolves.toBeUndefined();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('NXDOMAIN / tanpa MX+A+AAAA → ValidationError', async () => {
    const fetchFn = vi.fn().mockImplementation(() =>
      Promise.resolve(jsonResponse({ Status: 3 })),
    );
    const verifier = new DnsEmailDomainVerifier(fetchFn);

    await expect(verifier.assertReachable('zzznorecord.invalid')).rejects.toMatchObject({
      errorCode: 'VALIDATION_ERROR',
      details: [
        {
          field: 'email',
          message: 'Domain email tidak valid atau tidak dapat dijangkau',
        },
      ],
    });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('NOERROR tanpa Answer MX/A/AAAA → ValidationError', async () => {
    const fetchFn = vi.fn().mockImplementation(() =>
      Promise.resolve(jsonResponse({ Status: 0, Answer: [] })),
    );
    const verifier = new DnsEmailDomainVerifier(fetchFn);

    await expect(verifier.assertReachable('empty.example')).rejects.toBeInstanceOf(ValidationError);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('DoH 5xx / timeout → fail-open', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}, 503));
    const verifier = new DnsEmailDomainVerifier(fetchFn);
    await expect(verifier.assertReachable('example.com')).resolves.toBeUndefined();

    const abortFn = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));
    const verifierAbort = new DnsEmailDomainVerifier(abortFn);
    await expect(verifierAbort.assertReachable('example.com')).resolves.toBeUndefined();
  });

  it('hostname kosong / tanpa titik → ValidationError', async () => {
    const fetchFn = vi.fn();
    const verifier = new DnsEmailDomainVerifier(fetchFn);
    await expect(verifier.assertReachable('localhost')).rejects.toBeInstanceOf(ValidationError);
    await expect(verifier.assertReachable('')).rejects.toBeInstanceOf(ValidationError);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
