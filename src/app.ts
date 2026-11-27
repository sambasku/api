/** HTTP app shell. Dependency + routes: `composition/`. */
import { apiReference } from "@scalar/hono-api-reference";
import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";
import { cors } from "hono/cors";
import { env } from "@/shared/config/env";
import { sql } from "drizzle-orm";
import { db } from "@/shared/database/drizzle/client";
import { errorHandler } from "@/shared/middlewares/error-handler.middleware";
import { requestIdMiddleware } from "@/shared/middlewares/request-id.middleware";
import { requestDb } from "@/shared/middlewares/request-db.middleware";
import { createOpenApiApp } from "@/shared/openapi/openapi-app";
import { registerRoutes } from './composition/register-routes';
export {
  runDueNotificationCampaigns,
  runDueAchievementScan,
  runDueLeaderboardJobs,
  runDueStreakReminder,
  runDueBalehoRelease,
  runDueHotViewedSlotsSync,
} from './composition/cron-jobs';

// ---- HTTP app ----
export const app = createOpenApiApp();
app.onError(errorHandler);

// Route tidak ditemukan - HARUS envelope juga (api-base-stack.md Section 13).
// Tanpa ini Hono balas plain text "404 Not Found".
app.notFound((c) =>
  c.json(
    {
      success: false as const,
      error_code: "NOT_FOUND",
      message: "Route-nya tidak ketemu, coba cek lagi ya.",
      details: null,
    },
    404,
  ),
);

app.use("*", requestIdMiddleware);
// Workers: pool DB per-request (WebSocket = I/O milik request, lihat client.ts)
app.use("*", requestDb);
// Origin allowlist tetap dapat credentials (konsol / situs). Origin lain
// boleh baca API publik (kamus) lewat Access-Control-Allow-Origin: *.
app.use(
  "/api/*",
  cors({
    origin: (origin) => {
      if (origin && env.CORS_ALLOWED_ORIGINS.includes(origin)) return origin;
      return "*";
    },
    credentials: true,
  }),
);

// Info singkat di root - meta route (bukan endpoint fitur, jadi tidak ikut OpenAPI spec)
app.get("/", (c) =>
  c.json({
    success: true as const,
    data: {
      name: "Kamus Digital Sambas-Indonesia API",
      // Semver paket (package.json). Bukan identitas deploy - pakai gitSha.
      version: "0.1.0",
      gitSha: env.gitSha,
      gitShaFull: env.gitShaFull,
      docs: "/docs",
      openapi: "/openapi.json",
    },
  }),
);

// Health check - dipakai orchestrator (Docker/K8s/Railway) untuk liveness
app.get("/health", async (c) => {
  try {
    await db.run(sql`SELECT 1`);
    return c.json({
      status: "ok",
      database: "up",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return c.json(
      {
        status: "error",
        database: "down",
        timestamp: new Date().toISOString(),
      },
      503,
    );
  }
});

// Canary CI/CD - dipakai memverifikasi deploy baru end-to-end:
// push → GitHub Actions → GET /api/v1/ping harus menunjukkan perubahan.
// `runtime` membuktikan entry mana yang melayani (dual-runtime).
// Terdaftar via createRoute agar muncul di OpenAPI spec + Scalar (Section 9)
// - beda dari / dan /health yang memang meta route di luar spec.
const pingRoute = createRoute({
  method: "get",
  path: "/api/v1/ping",
  tags: ["Misc"],
  summary: "Canary CI/CD - verifikasi deploy (tanpa auth, tanpa DB)",
  responses: {
    200: {
      description: "Pong + info runtime + gitSha deploy",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              pong: z.boolean(),
              time: z.string(),
              env: z.string(),
              runtime: z.enum(["node", "cloudflare-workers"]),
              host: z.string(),
              gitSha: z.string(),
              gitShaFull: z.string(),
            }),
          }),
        },
      },
    },
  },
});

app.openapi(pingRoute, (c) =>
  c.json({
    success: true as const,
    data: {
      pong: true,
      time: new Date().toISOString(),
      env: env.NODE_ENV,
      runtime:
        typeof navigator !== "undefined" &&
        navigator.userAgent === "Cloudflare-Workers"
          ? "cloudflare-workers"
          : "node",
      // `runtime` tidak cukup memilah tier: tier 2 dan 3 dua-duanya 'node'.
      // Host yang diminta memastikan tier mana yang benar-benar melayani -
      // dipakai memverifikasi failover mendarat di tempat yang diharapkan.
      host: c.req.header("host") ?? "unknown",
      // Cocokkan dengan tag GHCR `sha-…` / Commit di Actions.
      gitSha: env.gitSha,
      gitShaFull: env.gitShaFull,
    },
  }),
);


registerRoutes(app);

app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "Kamus Digital Sambas-Indonesia API",
    version: "1.0.0",
  },
});
app.get("/docs", apiReference({ spec: { url: "/openapi.json" } }));
