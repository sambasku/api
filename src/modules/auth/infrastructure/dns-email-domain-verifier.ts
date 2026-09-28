import { ValidationError } from '@/shared/errors/app-error';
import type { EmailDomainVerifierPort } from '../application/ports/email-domain-verifier.port';

const DOH_ENDPOINT = 'https://cloudflare-dns.com/dns-query';
const DOH_TIMEOUT_MS = 2_000;

/** Status DoH: NOERROR = 0, NXDOMAIN = 3. */
type DohStatus = 0 | 3 | number;

type DohResponse = {
  Status: DohStatus;
  Answer?: { type: number; data: string }[];
};

/** RR type codes: A=1, AAAA=28, MX=15. */
type DohType = 'MX' | 'A' | 'AAAA';

const RR: Record<DohType, number> = { A: 1, AAAA: 28, MX: 15 };

export class DnsEmailDomainVerifier implements EmailDomainVerifierPort {
  constructor(
    private readonly fetchFn: typeof fetch = fetch,
    private readonly timeoutMs = DOH_TIMEOUT_MS,
  ) {}

  async assertReachable(domain: string): Promise<void> {
    const host = domain.trim().toLowerCase().replace(/\.$/, '');
    if (!host || host.includes('..') || host.startsWith('.') || !host.includes('.')) {
      throw unreachable();
    }

    try {
      const mx = await this.query(host, 'MX');
      if (mx === 'transient') return;
      if (mx === 'ok') return;

      const a = await this.query(host, 'A');
      if (a === 'transient') return;
      if (a === 'ok') return;

      const aaaa = await this.query(host, 'AAAA');
      if (aaaa === 'transient') return;
      if (aaaa === 'ok') return;
    } catch {
      // Abort / network: fail-open supaya outage DoH tidak memblokir register.
      return;
    }

    throw unreachable();
  }

  /**
   * @returns `ok` = ada Answer type yang diminta; `empty` = NXDOMAIN / tanpa Answer;
   *          `transient` = timeout / HTTP non-2xx / JSON rusak (fail-open).
   */
  private async query(name: string, type: DohType): Promise<'ok' | 'empty' | 'transient'> {
    const url = new URL(DOH_ENDPOINT);
    url.searchParams.set('name', name);
    url.searchParams.set('type', type);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchFn(url, {
        method: 'GET',
        headers: { Accept: 'application/dns-json' },
        signal: controller.signal,
      });
      if (!res.ok) return 'transient';

      let body: DohResponse;
      try {
        body = (await res.json()) as DohResponse;
      } catch {
        return 'transient';
      }

      // NXDOMAIN atau NOERROR tanpa Answer yang cocok = domain tidak mail-capable.
      if (body.Status === 3) return 'empty';
      if (body.Status !== 0) return 'transient';

      const wanted = RR[type];
      const answers = body.Answer?.filter((a) => a.type === wanted) ?? [];
      return answers.length > 0 ? 'ok' : 'empty';
    } finally {
      clearTimeout(timer);
    }
  }
}

function unreachable(): ValidationError {
  return new ValidationError([
    { field: 'email', message: 'Domain email tidak valid atau tidak dapat dijangkau' },
  ]);
}
