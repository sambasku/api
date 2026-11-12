/**
 * Retry helper untuk script/CI yang bicara langsung ke Turso remote (hrana).
 *
 * Ratusan statement tulis berurutan pernah kena HTTP 429 rate-limit di CI
 * (pnpm db:migrate deploy). Strategi: batch statement (1 subrequest per 50)
 * + retry delay pendek untuk error transient (429/5xx/jaringan). Bukan
 * jalur request Worker - jalur request tetap hemat subrequest.
 */
import type { Client, InValue } from '@libsql/client';
import { isTransientLibsqlError } from './enable-foreign-keys';

export type LibsqlStatement = { sql: string; args: InValue[] };

const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 400;
/** Turso batch = 1 request HTTP per chunk; jangan lewati batas wajar. */
const BATCH_CHUNK = 50;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type WithLibsqlRetryOptions = {
	maxAttempts?: number;
	baseDelayMs?: number;
};

/** Jalankan fn, retry bila error libsql transient (429/5xx/jaringan). */
export async function withLibsqlRetry<T>(
	fn: () => Promise<T>,
	opts?: WithLibsqlRetryOptions,
): Promise<T> {
	const maxAttempts = opts?.maxAttempts ?? MAX_ATTEMPTS;
	const baseDelayMs = opts?.baseDelayMs ?? BASE_DELAY_MS;
	let lastError: unknown;
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await fn();
		} catch (err) {
			lastError = err;
			if (attempt >= maxAttempts || !isTransientLibsqlError(err)) break;
			await sleep(baseDelayMs * attempt);
		}
	}
	throw lastError;
}

/**
 * Eksekusi statement tulis dalam batch 50 per request HTTP dengan retry
 * transient. Semua statement wajib idempoten: retry menjalankan ulang
 * chunk utuh.
 */
export async function execBatched(
	client: Pick<Client, 'batch'>,
	statements: LibsqlStatement[],
): Promise<void> {
	if (statements.length === 0) return;
	for (let i = 0; i < statements.length; i += BATCH_CHUNK) {
		const chunk = statements.slice(i, i + BATCH_CHUNK);
		await withLibsqlRetry(() => client.batch(chunk, 'write'));
	}
}
