/**
 * PRAGMA foreign_keys saat module load.
 *
 * SQLite default: FK mati. Turso remote biasanya sudah ON; kita set eksplisit
 * supaya lokal/`file:` sama. Di Workers, execute ini = HTTP ke Turso - gagal
 * transient (mis. HTTP 525 SSL handshake) tidak boleh meracuni evaluasi modul
 * isolate (import gagal = module errored sampai recycle).
 */

import type { Client } from '@libsql/client';
import { collectMessages } from '@/shared/errors/error-chain';

const TRANSIENT_SIGNATURES = [
  'server_error',
  'server returned http status 5',
  // Rate-limit Turso (429): transient untuk script backfill yang di-batch
  // dan di-retry, bukan error data.
  'server returned http status 429',
  'network connection lost',
  'fetch failed',
  'econnreset',
  'etimedout',
  'socket hang up',
] as const;

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 50;

export function isTransientLibsqlError(err: unknown): boolean {
  const haystack = collectMessages(err).join(' ').toLowerCase();
  if (haystack === '') return false;
  return TRANSIENT_SIGNATURES.some((sig) => haystack.includes(sig));
}

export type EnableForeignKeysOptions = {
  /** Workers: soft-fail setelah retry. Node/file: throw (FK wajib). */
  softFail: boolean;
  log?: (message: string, err: unknown) => void;
  /** Override delay antar retry (tes). */
  retryDelayMs?: number;
  maxAttempts?: number;
};

export async function enableForeignKeys(
  client: Pick<Client, 'execute'>,
  options: EnableForeignKeysOptions,
): Promise<void> {
  const maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS;
  const delayMs = options.retryDelayMs ?? RETRY_DELAY_MS;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await client.execute('PRAGMA foreign_keys = ON');
      return;
    } catch (err) {
      lastError = err;
      const canRetry = isTransientLibsqlError(err) && attempt < maxAttempts;
      if (!canRetry) break;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  if (options.softFail) {
    options.log?.(
      'PRAGMA foreign_keys gagal setelah retry; lanjut (Turso remote biasanya FK ON)',
      lastError,
    );
    return;
  }

  throw lastError;
}
