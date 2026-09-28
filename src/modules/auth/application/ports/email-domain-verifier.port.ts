/**
 * Cek domain email (bagian setelah @) punya rekaman DNS mail-capable.
 * Impl produksi: DNS-over-HTTPS (MX, fallback A/AAAA).
 */
export interface EmailDomainVerifierPort {
  assertReachable(domain: string): Promise<void>;
}
