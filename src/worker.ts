// Entry CLOUDFLARE WORKERS - pasangan runtime untuk main.ts (Node).
// Dua entry berbagi satu composition root (app.ts) tanpa perubahan.
//
// Pola: LAZY IMPORT. app.ts (dan env.ts/client.ts di dalamnya) membaca
// process.env saat module load - di Workers, env datang dari BINDINGS,
// jadi isi process.env dulu (via nodejs_compat), baru import aplikasi.
// Satu kali per isolate; isolate dipakai ulang antar request.

/** Bindings wrangler.toml: [vars] + secrets */
interface Env {
  [key: string]: unknown;
}

// Tipe `app` via import type-only (dihapus saat build - runtime tetap lazy)
type AppModule = typeof import('./app');

let appPromise: Promise<AppModule> | null = null;

function loadApp(env: Env): Promise<AppModule> {
  if (!appPromise) {
    appPromise = bootstrap(env)
      .then(() => import('./app'));
  }
  return appPromise;
}

export default {
  fetch(request: Request, env: Env, ctx: unknown): Promise<Response> {
    return loadApp(env).then((m) => m.app.fetch(request as never, env as never, ctx as never));
  },

/** Cron: lanjutkan campaign sending + jalankan scheduled yang sudah due. */
  async scheduled(
    _controller: { cron: string; scheduledTime: number },
    env: Env,
    _ctx: { waitUntil: (p: Promise<unknown>) => void },
  ): Promise<void> {
    const m = await loadApp(env);
    try {
      const result = await m.runDueNotificationCampaigns();
      console.log(
        JSON.stringify({
          level: 'info',
          msg: 'notification campaign cron done',
          processed: result.processed,
        }),
      );
    } catch (error) {
      // Transient DB/network error (Turso HTTP) tidak boleh jadi unhandled
      // exception tiap tick cron; tick berikutnya otomatis retry (idempoten).
      console.error(
        JSON.stringify({
          level: 'error',
          msg: 'notification campaign cron failed',
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }

    // Scan achievement (due-check 6 jam di use case). Kegagalan scan tidak
    // boleh menghentikan cron lain - ditangkap terpisah.
    try {
      const result = await m.runDueAchievementScan();
      console.log(
        JSON.stringify({
          level: 'info',
          msg: 'achievement scan cron done',
          scanned: result.scanned,
          awarded: result.awarded,
          ran: result.ran,
        }),
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          msg: 'achievement scan cron failed',
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }

    try {
      const result = await m.runDueStreakReminder();
      console.log(
        JSON.stringify({
          level: 'info',
          msg: 'streak reminder cron done',
          ran: result.ran,
          sent: result.sent,
          reason: result.reason ?? null,
        }),
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          msg: 'streak reminder cron failed',
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  },
};

/** bindings string → process.env, SEBELUM app di-import */
async function bootstrap(env: Env): Promise<void> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') vars[key] = value;
  }
  Object.assign(process.env, vars);
}
