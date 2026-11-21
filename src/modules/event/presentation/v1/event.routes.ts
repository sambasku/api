import type { MiddlewareHandler } from "hono";
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
import type { EventController } from "./event.controller";
import {
  cancelEventBodySchema,
  createEventBodySchema,
  createEventCommentBodySchema,
  eventCategoryListResponseSchema,
  eventCommentResponseSchema,
  eventCommentsQuerySchema,
  eventResponseSchema,
  listEventsQuerySchema,
  listEventsResponseSchema,
  updateEventBodySchema,
  updateEventCommentBodySchema,
} from "./validators/event.validator";

const json = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

const idParam = z.object({ id: z.string().min(1).max(64) });
const slugParam = z.object({ slug: z.string().min(1).max(120) });

export function createPublicEventRoutes(deps: {
  controller: EventController;
  /** Tanpa token = tamu. Utuh untuk list (publik) dan detail. */
  optionalAuthenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use("*", rateLimit({ points: 120, duration: 60 }));
  routes.use("*", deps.optionalAuthenticate);

  const listRoute = createRoute({
    method: "get",
    path: "/",
    tags: ["Events"],
    summary: "List acara published (publik)",
    request: { query: listEventsQuerySchema },
    responses: {
      200: {
        description: "Daftar acara",
        content: json(listEventsResponseSchema),
      },
      400: {
        description: "Query tidak valid",
        content: json(errorResponseSchema),
      },
    },
  });

  const getRoute = createRoute({
    method: "get",
    path: "/:slug",
    tags: ["Events"],
    summary: "Detail acara by slug (publik)",
    request: { params: slugParam },
    responses: {
      200: {
        description: "Detail acara",
        content: json(eventResponseSchema),
      },
      404: {
        description: "Tidak ditemukan",
        content: json(errorResponseSchema),
      },
    },
  });

  const categoriesRoute = createRoute({
    method: "get",
    path: "/categories",
    tags: ["Events"],
    summary: "Katalog kategori acara (publik)",
    responses: {
      200: {
        description: "Daftar kategori acara",
        content: json(eventCategoryListResponseSchema),
      },
    },
  });

  routes.openapi(
    listRoute,
    (c) => deps.controller.listPublic(c, c.req.valid("query")) as never,
  );
  // `/categories` HARUS didaftarkan sebelum `/:slug` - Hono mencocokkan
  // route sesuai urutan registrasi, jadi slug param akan menelan
  // "/categories" kalau belakangan.
  routes.openapi(categoriesRoute, (c) =>
    deps.controller.listCategories(c, true) as never,
  );
  routes.openapi(
    getRoute,
    (c) => deps.controller.getBySlug(c, c.req.param("slug")) as never,
  );

  // ---------------------------------------------------------------- galeri foto
  const imagesListRoute = createRoute({
    method: "get",
    path: "/:slug/images",
    tags: ["Events"],
    summary: "Galeri foto acara, 12 per halaman",
    request: {
      params: slugParam,
      query: z.object({ offset: z.coerce.number().int().min(0).default(0) }),
    },
    responses: {
      200: {
        description: "Halaman foto",
        content: json(
          z.object({ success: z.literal(true) }).passthrough(),
        ),
      },
      404: { description: "Acara tidak ditemukan", content: json(errorResponseSchema) },
    },
  });

  routes.openapi(imagesListRoute, (c) =>
    deps.controller.listImages(c) as never,
  );

  return routes;
}
export function createUserEventImageRoutes(deps: {
  controller: EventController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use("*", rateLimit({ points: 30, duration: 60 }));
  routes.use("*", deps.authenticate);
  const appendRoute = createRoute({
    method: "post",
    path: "/:slug/images",
    tags: ["Events"],
    summary: "Tambah foto ke acara terbit (login, max 4 per submit)",
    request: {
      params: slugParam,
      body: {
        content: {
          "application/json": {
            schema: z.object({ urls: z.array(z.string().url()).min(1).max(4) }),
          },
        },
      },
    },
    responses: {
      200: { description: "Foto ditambahkan", content: json(okNullResponseSchema) },
      400: { description: "Batas foto", content: json(errorResponseSchema) },
      401: { description: "Tidak terautentikasi", content: json(errorResponseSchema) },
    },
  });
  routes.openapi(appendRoute, (c) => deps.controller.appendImages(c) as never);
  return routes;
}

export function createAdminEventRoutes(deps: {
  controller: EventController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use("*", rateLimit({ points: 60, duration: 60 }));
  routes.use("*", deps.authenticate, authorizeRole("root", "admin", "reviewer"));

  const listRoute = createRoute({
    method: "get",
    path: "/",
    tags: ["Admin Events"],
    summary: "List acara (semua status)",
    request: { query: listEventsQuerySchema },
    responses: {
      200: {
        description: "Daftar acara",
        content: json(listEventsResponseSchema),
      },
      400: {
        description: "Query tidak valid",
        content: json(errorResponseSchema),
      },
    },
  });

  const categoriesRoute = createRoute({
    method: "get",
    path: "/categories",
    tags: ["Admin Events"],
    summary: "Katalog kategori acara (admin)",
    responses: {
      200: {
        description: "Daftar kategori acara",
        content: json(eventCategoryListResponseSchema),
      },
    },
  });

  const createRouteDef = createRoute({
    method: "post",
    path: "/",
    tags: ["Admin Events"],
    summary: "Buat acara",
    request: {
      body: {
        content: { "application/json": { schema: createEventBodySchema } },
      },
    },
    responses: {
      200: {
        description: "Acara dibuat",
        content: json(eventResponseSchema),
      },
      400: {
        description: "Body tidak valid",
        content: json(errorResponseSchema),
      },
      409: { description: "Slug bentrok", content: json(errorResponseSchema) },
    },
  });

  const updateRoute = createRoute({
    method: "patch",
    path: "/:id",
    tags: ["Admin Events"],
    summary: "Edit acara",
    request: {
      params: idParam,
      body: {
        content: { "application/json": { schema: updateEventBodySchema } },
      },
    },
    responses: {
      200: {
        description: "Acara diperbarui",
        content: json(eventResponseSchema),
      },
      404: {
        description: "Tidak ditemukan",
        content: json(errorResponseSchema),
      },
      409: { description: "Slug bentrok", content: json(errorResponseSchema) },
    },
  });

  const cancelRoute = createRoute({
    method: "post",
    path: "/:id/cancel",
    tags: ["Admin Events"],
    summary: "Batalkan / pulihkan acara",
    request: {
      params: idParam,
      body: {
        content: { "application/json": { schema: cancelEventBodySchema } },
      },
    },
    responses: {
      200: {
        description: "Status pembatalan diperbarui",
        content: json(eventResponseSchema),
      },
      404: {
        description: "Tidak ditemukan",
        content: json(errorResponseSchema),
      },
    },
  });

  const deleteRoute = createRoute({
    method: "delete",
    path: "/:id",
    tags: ["Admin Events"],
    summary: "Soft-delete acara",
    request: { params: idParam },
    responses: {
      200: { description: "Terhapus", content: json(okNullResponseSchema) },
      404: {
        description: "Tidak ditemukan",
        content: json(errorResponseSchema),
      },
    },
  });

  routes.openapi(
    listRoute,
    (c) => deps.controller.listAdmin(c, c.req.valid("query")) as never,
  );
  routes.openapi(categoriesRoute, (c) =>
    deps.controller.listCategories(c, false) as never,
  );
  routes.openapi(
    createRouteDef,
    (c) => deps.controller.create(c, c.req.valid("json")) as never,
  );
  routes.openapi(
    updateRoute,
    (c) =>
      deps.controller.update(c, c.req.param("id"), c.req.valid("json")) as never,
  );
  routes.openapi(
    cancelRoute,
    (c) =>
      deps.controller.setCancelled(
        c,
        c.req.param("id"),
        c.req.valid("json"),
      ) as never,
  );
  routes.openapi(
    deleteRoute,
    (c) => deps.controller.remove(c, c.req.param("id")) as never,
  );

  // Galeri foto acara (admin: takedown).
  const hideImageRoute = createRoute({
    method: "delete",
    path: "/:id/images/:imageId",
    tags: ["Admin Events"],
    summary: "Takedown foto acara (admin)",
    request: { params: z.object({ id: z.string().min(1).max(64), imageId: z.string().min(1).max(64) }) },
    responses: {
      200: { description: "Takedown", content: json(okNullResponseSchema) },
      404: { description: "Acara/foto tidak ditemukan", content: json(errorResponseSchema) },
    },
  });

  routes.openapi(hideImageRoute, (c) =>
    deps.controller.hideImage(c) as never,
  );
  return routes;
}

// ---------------------------------------------------------------- komentar publik + user

const commentIdParam = z.object({ id: z.string().min(1).max(64) });
const commentListSchema = z.object({ success: z.literal(true), data: z.object({
  items: z.array(eventCommentResponseSchema),
  next_cursor: z.string().nullable(),
  has_more: z.boolean(),
}) });
const commentItemSchema = z.object({ success: z.literal(true), data: eventCommentResponseSchema });

export function createPublicEventCommentRoutes(deps: {
  controller: EventController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
  optionalAuthenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use("*", rateLimit({ points: 120, duration: 60 }));

  const listRoute = createRoute({
    method: "get",
    path: "/:id/comments",
    tags: ["Event Comments"],
    summary: "List komentar acara (publik)",
    request: { params: idParam, query: eventCommentsQuerySchema },
    responses: {
      200: { description: "Daftar komentar", content: json(commentListSchema) },
    },
  });

  const createRoute_ = createRoute({
    method: "post",
    path: "/:id/comments",
    tags: ["Event Comments"],
    summary: "Tambah komentar acara (login)",
    request: {
      params: idParam,
      body: { content: json(createEventCommentBodySchema) },
    },
    responses: {
      201: { description: "Komentar dibuat", content: json(commentItemSchema) },
      401: { description: "Tidak terautentikasi", content: json(errorResponseSchema) },
      404: { description: "Acara tidak ditemukan", content: json(errorResponseSchema) },
    },
  });

  const updateRoute_ = createRoute({
    method: "patch",
    path: "/comments/:id",
    tags: ["Event Comments"],
    summary: "Edit komentar (penulis sendiri)",
    request: {
      params: commentIdParam,
      body: { content: json(updateEventCommentBodySchema) },
    },
    responses: {
      200: { description: "Komentar diperbarui", content: json(commentItemSchema) },
      401: { description: "Tidak terautentikasi", content: json(errorResponseSchema) },
      404: { description: "Komentar tidak ditemukan", content: json(errorResponseSchema) },
    },
  });

  const deleteRoute_ = createRoute({
    method: "delete",
    path: "/comments/:id",
    tags: ["Event Comments"],
    summary: "Hapus komentar (penulis sendiri)",
    request: { params: commentIdParam },
    responses: {
      200: { description: "Terhapus", content: json(okNullResponseSchema) },
      401: { description: "Tidak terautentikasi", content: json(errorResponseSchema) },
      404: { description: "Komentar tidak ditemukan", content: json(errorResponseSchema) },
    },
  });

  const createAudioRoute = createRoute({
    method: "post",
    path: "/:id/comments/audio",
    tags: ["Event Comments"],
    summary: "Komentar acara dengan rekaman suara (multipart; publish langsung)",
    request: { params: idParam },
    responses: {
      201: { description: "Komentar dibuat", content: json(commentItemSchema) },
      401: { description: "Tidak terautentikasi", content: json(errorResponseSchema) },
      404: { description: "Acara tidak ditemukan", content: json(errorResponseSchema) },
    },
  });

  routes.use("/:id/comments", deps.optionalAuthenticate);
  routes.use("/:id/comments/audio", deps.authenticate, bodyLimit({
    maxSize: 6 * 1024 * 1024,
    onError: (c) =>
      c.json(
        {
          success: false as const,
          error_code: "AUDIO_TOO_LARGE",
          message: "File audio terlalu besar (maks 5 MB)",
        },
        400,
      ),
  }));
  routes.use("/comments/:id", deps.authenticate);

  routes.openapi(listRoute, (c) => deps.controller.listComments(c) as never);
  routes.openapi(
    createRoute_,
    (c) => deps.controller.createComment(c) as never,
  );
  routes.openapi(createAudioRoute, (c) => deps.controller.createCommentAudio(c) as never);
  routes.openapi(
    updateRoute_,
    (c) => deps.controller.updateComment(c) as never,
  );
  routes.openapi(
    deleteRoute_,
    (c) => deps.controller.deleteComment(c) as never,
  );
  return routes;
}

export function createAdminEventCommentRoutes(deps: {
  controller: EventController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use("*", rateLimit({ points: 60, duration: 60 }));
  routes.use("*", deps.authenticate, authorizeRole("root", "admin", "reviewer"));

  const takedownRoute = createRoute({
    method: "post",
    path: "/comments/:id/takedown",
    tags: ["Admin Event Comments"],
    summary: "Takedown komentar acara (admin)",
    request: { params: commentIdParam },
    responses: {
      200: { description: "Takedown berhasil", content: json(okNullResponseSchema) },
      404: { description: "Komentar tidak ditemukan", content: json(errorResponseSchema) },
    },
  });

  routes.openapi(takedownRoute, (c) => deps.controller.takedownComment(c) as never);
  return routes;
}
