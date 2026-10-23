import type { Context, MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";
import { authorizeRole } from "@/shared/middlewares/authorize-role.middleware";
import { rateLimit } from "@/shared/middlewares/rate-limit.middleware";
import { createOpenApiApp } from "@/shared/openapi/openapi-app";
import {
  errorResponseSchema,
  okNullResponseSchema,
} from "@/shared/openapi/error-response.schema";
import type { AppVariables } from "@/shared/types";
import type { EventContributionController } from "./event-contribution.controller";
import {
  rejectEventContributionBodySchema,
  requestRevisionBodySchema,
  resubmitEventContributionBodySchema,
  submitEventContributionBodySchema,
} from "./validators/event-contribution.validator";

const json = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});
const idParam = z.object({ id: z.string().min(1).max(64) });
const okItem = z.object({
  success: z.literal(true),
  data: z.object({ id: z.string() }).passthrough(),
});
const okList = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(z.object({ id: z.string() }).passthrough()),
  }),
});

export function createEventContributionRoutes(deps: {
  controller: EventContributionController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
  /** Tanpa token, usulan diatribusikan ke user sistem anonim. */
  optionalAuthenticate: MiddlewareHandler<{ Variables: AppVariables }>;
  uploadEventImage: (c: Context) => Promise<Response> | Response;
}) {
  const routes = createOpenApiApp();
  routes.use("*", rateLimit({ points: 30, duration: 60 }));
  routes.use("*", async (c, next) => {
    if (c.req.method === "POST") return deps.optionalAuthenticate(c, next);
    return deps.authenticate(c, next);
  });
  // Tier ketat untuk request TANPA token (usulan anonim): submit 5/jam per IP,
  // unggah poster 10/jam per IP (1 poster per usulan + margin).
  const anonSubmitLimit = rateLimit({ points: 5, duration: 60 * 60 });
  const anonImageLimit = rateLimit({ points: 10, duration: 60 * 60 });
  routes.use("*", async (c, next) => {
    if (c.req.method !== "POST" || c.get("user")) return next();
    const limiter = c.req.path.endsWith("/images") ? anonImageLimit : anonSubmitLimit;
    return limiter(c, next);
  });
  routes.use(
    "/images",
    bodyLimit({
      maxSize: 6 * 1024 * 1024,
      onError: (c) =>
        c.json(
          {
            success: false as const,
            error_code: "IMAGE_TOO_LARGE",
            message: "File gambar terlalu besar (maks 5 MB)",
          },
          400,
        ),
    }),
  );

  const uploadRoute = createRoute({
    method: "post",
    path: "/images",
    tags: ["Event contributions"],
    summary: "Unggah poster usulan acara (boleh tanpa login) - multipart field `file`",
    responses: {
      201: {
        description: "Poster tersimpan",
        content: json(z.object({ success: z.literal(true) }).passthrough()),
      },
      400: { description: "File tidak valid", content: json(errorResponseSchema) },
    },
  });
  routes.openapi(uploadRoute, (c) => deps.uploadEventImage(c) as never);

  const submitRoute = createRoute({
    method: "post",
    path: "/",
    tags: ["Event contributions"],
    summary: "Kirim usulan acara (menunggu tinjauan)",
    request: {
      body: {
        content: { "application/json": { schema: submitEventContributionBodySchema } },
      },
    },
    responses: {
      200: { description: "Usulan tersimpan", content: json(okItem) },
      400: { description: "Body tidak valid", content: json(errorResponseSchema) },
      409: { description: "Batas atau bentrok", content: json(errorResponseSchema) },
    },
  });

  const mineRoute = createRoute({
    method: "get",
    path: "/mine",
    tags: ["Event contributions"],
    summary: "Usulan milik user login",
    responses: {
      200: { description: "Daftar usulan", content: json(okList) },
    },
  });

  const cancelRoute = createRoute({
    method: "delete",
    path: "/:id",
    tags: ["Event contributions"],
    summary: "Batalkan usulan yang masih menunggu",
    request: { params: idParam },
    responses: {
      200: { description: "Dibatalkan", content: json(okNullResponseSchema) },
      404: {
        description: "Tidak ditemukan",
        content: json(errorResponseSchema),
      },
    },
  });

  const resubmitRoute = createRoute({
    method: "put",
    path: "/:id",
    tags: ["Event contributions"],
    summary: "Kirim ulang usulan yang diminta revisi",
    request: {
      params: idParam,
      body: {
        content: {
          "application/json": { schema: resubmitEventContributionBodySchema },
        },
      },
    },
    responses: {
      200: { description: "Usulan terkirim ulang", content: json(okItem) },
      400: { description: "Body tidak valid", content: json(errorResponseSchema) },
      409: { description: "Bukan usulan revisi", content: json(errorResponseSchema) },
    },
  });

  routes.openapi(
    submitRoute,
    (c) => deps.controller.submit(c, c.req.valid("json")) as never,
  );
  routes.openapi(mineRoute, (c) => deps.controller.mine(c) as never);
  routes.openapi(
    cancelRoute,
    (c) => deps.controller.cancel(c, c.req.param("id")) as never,
  );
  routes.openapi(
    resubmitRoute,
    (c) =>
      deps.controller.resubmit(
        c,
        c.req.param("id"),
        c.req.valid("json"),
      ) as never,
  );
  return routes;
}

export function createAdminEventContributionRoutes(deps: {
  controller: EventContributionController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use("*", rateLimit({ points: 60, duration: 60 }));
  routes.use("*", deps.authenticate, authorizeRole("root", "admin", "reviewer"));

  const listRoute = createRoute({
    method: "get",
    path: "/",
    tags: ["Admin event contributions"],
    summary: "Usulan acara yang menunggu",
    responses: {
      200: { description: "Daftar", content: json(okList) },
    },
  });

  const approveRoute = createRoute({
    method: "post",
    path: "/:id/approve",
    tags: ["Admin event contributions"],
    request: { params: idParam },
    responses: {
      200: { description: "Disetujui", content: json(okNullResponseSchema) },
      409: {
        description: "Usulan basi atau bentrok",
        content: json(errorResponseSchema),
      },
    },
  });

  const rejectRoute = createRoute({
    method: "post",
    path: "/:id/reject",
    tags: ["Admin event contributions"],
    request: {
      params: idParam,
      body: {
        content: {
          "application/json": { schema: rejectEventContributionBodySchema },
        },
      },
    },
    responses: {
      200: { description: "Ditolak", content: json(okNullResponseSchema) },
    },
  });

  const revisionRoute = createRoute({
    method: "post",
    path: "/:id/request-revision",
    tags: ["Admin event contributions"],
    summary: "Minta revisi usulan",
    request: {
      params: idParam,
      body: {
        content: { "application/json": { schema: requestRevisionBodySchema } },
      },
    },
    responses: {
      200: {
        description: "Revisi diminta",
        content: json(okNullResponseSchema),
      },
    },
  });

  routes.openapi(listRoute, (c) => deps.controller.listPending(c) as never);
  routes.openapi(
    approveRoute,
    (c) => deps.controller.approve(c, c.req.param("id")) as never,
  );
  routes.openapi(
    rejectRoute,
    (c) =>
      deps.controller.reject(c, c.req.param("id"), c.req.valid("json")) as never,
  );
  routes.openapi(
    revisionRoute,
    (c) =>
      deps.controller.requestRevision(
        c,
        c.req.param("id"),
        c.req.valid("json"),
      ) as never,
  );
  return routes;
}
