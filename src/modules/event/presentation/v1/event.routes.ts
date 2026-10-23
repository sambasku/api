import type { MiddlewareHandler } from "hono";
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
  eventCategoryListResponseSchema,
  eventResponseSchema,
  listEventsQuerySchema,
  listEventsResponseSchema,
  updateEventBodySchema,
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
  return routes;
}
