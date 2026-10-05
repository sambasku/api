/**
 * Catat hasil ping keep-alive Supabase ke supabase_health_checks (DATABASE_URL).
 * Dipanggil dari workflow Supabase Keep-Alive (repo api) setelah curl health check.
 * Tabel wajib sudah ada dari migrasi API 0056 - tidak CREATE TABLE di sini.
 * Selalu INSERT baris baru (sifatnya log historis, bukan status tunggal).
 *
 * Env:
 *   DATABASE_URL, DATABASE_AUTH_TOKEN (wajib)
 *   ENV_NAME - staging | production (default staging)
 *   PROJECT_LABEL, PROJECT_REF, HTTP_STATUS, STATUS (ok|failed)
 *   TIME_START - epoch ms; ERROR_MESSAGE opsional
 *   GITHUB_RUN_ID, GITHUB_SERVER_URL, GITHUB_REPOSITORY (bawaan Actions)
 *   RECORD_SUPABASE_HEALTH - set 0 untuk skip (lokal)
 */
import { createClient } from '@libsql/client';

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== '' ? v.trim() : undefined;
}

async function main() {
  if (env('RECORD_SUPABASE_HEALTH') === '0') {
    console.log('RECORD_SUPABASE_HEALTH=0 - skip insert log');
    return;
  }
  if (!env('GITHUB_RUN_ID') && env('RECORD_SUPABASE_HEALTH') !== '1') {
    console.log('bukan CI dan RECORD_SUPABASE_HEALTH!=1 - skip insert log');
    return;
  }

  const url = env('DATABASE_URL');
  if (!url) {
    console.error('error: DATABASE_URL wajib');
    process.exit(1);
  }

  const envName = env('ENV_NAME') === 'production' ? 'production' : 'staging';
  const status = env('STATUS') === 'failed' ? 'failed' : 'ok';
  const httpStatus = Number(env('HTTP_STATUS')) || null;
  const timeStartMs = Number(env('TIME_START')) || Date.now();
  const timeEndMs = Date.now();

  const runId = env('GITHUB_RUN_ID');
  const server = (env('GITHUB_SERVER_URL') ?? 'https://github.com').replace(/\/+$/, '');
  const repo = env('GITHUB_REPOSITORY');
  const runUrl = runId && repo ? `${server}/${repo}/actions/runs/${runId}` : undefined;

  const client = createClient({ url, authToken: env('DATABASE_AUTH_TOKEN') });
  try {
    await client.execute({
      sql: `INSERT INTO supabase_health_checks (
        id, created_at, updated_at,
        project_label, project_ref, env,
        http_status, status, time_start, time_end, duration_ms,
        github_run_id, github_run_url, error_message
      ) VALUES (
        substr(upper(hex(randomblob(16))), 1, 26),
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )`,
      args: [
        Math.floor(timeEndMs / 1000),
        Math.floor(timeEndMs / 1000),
        env('PROJECT_LABEL') ?? `sambasku-${envName}`,
        env('PROJECT_REF') ?? new URL(url).hostname.split('.')[0],
        envName,
        httpStatus,
        status,
        Math.floor(timeStartMs / 1000),
        Math.floor(timeEndMs / 1000),
        Math.max(0, timeEndMs - timeStartMs),
        runId ?? null,
        runUrl ?? null,
        env('ERROR_MESSAGE') ?? null,
      ],
    });
    console.log(`==> supabase_health_checks env=${envName} status=${status} http=${httpStatus ?? '-'}`);
  } finally {
    client.close();
  }
}

main().catch((err) => {
  console.error('error: INSERT supabase_health_checks gagal', err);
  console.error('Pastikan migrasi API 0056_supabase-health-checks sudah jalan di database ini.');
  process.exit(1);
});
