import { ServiceUnavailableError } from '@/shared/errors/app-error';
import { env } from '@/shared/config/env';
import { logger } from '@/shared/logging/logger';
import type { SupabaseHealthCheckRepository } from '../../domain/repositories/supabase-health-check.repository';

const PING_TIMEOUT_MS = 10_000;

/** Ref project = subdomain .supabase.co (ID yang muncul di email pause Supabase). */
function projectRefFromUrl(url: string): string {
  try {
    return new URL(url).hostname.split('.')[0];
  } catch {
    return 'unknown';
  }
}

/**
 * Ping manual dari console: fetch /auth/v1/health langsung (sinkron),
 * hasilnya INSERT ke supabase_health_checks dengan github_run_id = 'console'
 * (bedakan dari ping CI yang punya run URL).
 *
 * ponytail: satu project Supabase aktif - env SUPABASE_URL/SUPABASE_ANON_KEY
 * tunggal, label selalu 'sambasku-staging' & kolom env 'staging'. Bila nanti
 * ada project kedua: tambah SUPABASE_PROD_* + pilih target dari body.
 */
export class TriggerSupabaseHealthCheckUseCase {
  constructor(private readonly repo: SupabaseHealthCheckRepository) {}

  async execute(_input: { actorUserId: string }): Promise<{
    status: 'ok' | 'failed';
    http_status: number | null;
    duration_ms: number;
    error_message: string | null;
  }> {
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      throw new ServiceUnavailableError(
        'SUPABASE_PING_UNAVAILABLE',
        'Ping Supabase belum dikonfigurasi - butuh SUPABASE_URL dan SUPABASE_ANON_KEY',
      );
    }

    const timeStart = new Date();
    let httpStatus: number | null = null;
    let errorMessage: string | null = null;

    try {
      const res = await fetch(`${env.SUPABASE_URL}/auth/v1/health`, {
        headers: { apikey: env.SUPABASE_ANON_KEY },
        signal: AbortSignal.timeout(PING_TIMEOUT_MS),
      });
      httpStatus = res.status;
      if (!res.ok) errorMessage = `Health check balas HTTP ${res.status}`;
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Fetch gagal';
      logger.warn({ err, url: env.SUPABASE_URL }, 'Ping Supabase console gagal');
    }

    const timeEnd = new Date();
    const status = httpStatus === 200 ? 'ok' : 'failed';
    await this.repo.create({
      projectLabel: 'sambasku-staging',
      projectRef: projectRefFromUrl(env.SUPABASE_URL),
      env: 'staging',
      httpStatus,
      status,
      timeStart,
      timeEnd,
      durationMs: timeEnd.getTime() - timeStart.getTime(),
      // Penanda sumber console (ping CI selalu punya github_run_url).
      githubRunId: 'console',
      githubRunUrl: null,
      errorMessage,
    });

    return {
      status,
      http_status: httpStatus,
      duration_ms: timeEnd.getTime() - timeStart.getTime(),
      error_message: errorMessage,
    };
  }
}
