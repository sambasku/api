import { env } from '@/shared/config/env';
import type { EmailDomainVerifierPort } from '../application/ports/email-domain-verifier.port';
import { DnsEmailDomainVerifier } from './dns-email-domain-verifier';

/** Stub e2e/unit: jangan hit DoH (email tes sering @test.com). */
class AllowAllEmailDomainVerifier implements EmailDomainVerifierPort {
  async assertReachable(): Promise<void> {}
}

export function createEmailDomainVerifier(): EmailDomainVerifierPort {
  if (env.NODE_ENV === 'test') return new AllowAllEmailDomainVerifier();
  return new DnsEmailDomainVerifier();
}
