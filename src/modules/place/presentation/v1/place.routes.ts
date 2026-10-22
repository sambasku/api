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
import type { PlaceController } from "./place.controller";
import {
  createPlaceBodySchema,
  listPlacesQuerySchema,
  placeItemResponseSchema,
  placeListResponseSchema,
  updatePlaceBodySchema,
} from "./validators/place.validator";

const json = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

const idParam = z.object({ id: z.string().min(1).max(64) });
const slugParam = z.object({ slug: z.string().min(1).max(120) });

const imagePageQuery = z.object({
  offset: z.coerce.number().int().min(0).default(0),
});
const appendImagesBody = z.object({
  urls: z.array(z.string().url().startsWith("https://")).min(1).max(5),
});

export function createPublicPlaceRoutes(deps: {
  controller: PlaceController;
  /** Tanpa token = kredit ke user sistem anonim. */
  optionalAuthenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use("*", rateLimit({ points: 120, duration: 60 }));

  const listRoute = createRoute({
    method: "get",
    path: "/",
    tags: ["Places"],
    summary: "List place published (publik)",
    request: { query: listPlacesQuerySchema },
    responses: {
      200: {
        description: "Daftar place",
        content: json(placeListResponseSchema),
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
    tags: ["Places"],
    summary: "Detail place by slug (publik)",
    request: { params: slugParam },
    responses: {
      200: {
        description: "Detail place",
        content: json(placeItemResponseSchema),
      },
      404: {
        description: "Tidak ditemukan",
        content: json(errorResponseSchema),
      },
    },
  });

  const imagesRoute = createRoute({
    method: "get",
    path: "/:slug/images",
    tags: ["Places"],
    summary: "Galeri foto tempat, 12 per halaman",
    request: { params: slugParam, query: imagePageQuery },
    responses: {
      200: {
        description: "Halaman foto",
        content: json(z.object({ success: z.literal(true) }).passthrough()),
      },
    },
  });
  const appendRoute = createRoute({
    method: "post",
    path: "/:slug/images",
    tags: ["Places"],
    summary: "Tambah foto ke tempat yang sudah terbit",
    request: {
      params: slugParam,
      body: { content: { "application/json": { schema: appendImagesBody } } },
    },
    responses: {
      200: {
        description: "Foto ditambahkan",
        content: json(okNullResponseSchema),
      },
      400: { description: "Batas foto", content: json(errorResponseSchema) },
    },
  });

  const recordViewRoute = createRoute({
    method: "post",
    path: "/:slug/view",
    tags: ["Places"],
    summary: "Catat 1 view detail place (web + mobile)",
    request: { params: slugParam },
    responses: {
      200: {
        description: "View tercatat (slug tak dikenal = no-op)",
        content: json(okNullResponseSchema),
      },
    },
  });

  routes.use("/:slug/images", async (c, next) => {
    if (c.req.method === "POST") return deps.optionalAuthenticate(c, next);
    return next();
  });
  routes.openapi(
    listRoute,
    (c) => deps.controller.listPublic(c, c.req.valid("query")) as never,
  );
  routes.openapi(
    imagesRoute,
    (c) =>
      deps.controller.listImages(
        c,
        c.req.param("slug"),
        c.req.valid("query").offset,
      ) as never,
  );
  routes.openapi(
    appendRoute,
    (c) =>
      deps.controller.appendImages(
        c,
        c.req.param("slug"),
        c.req.valid("json").urls,
      ) as never,
  );
  routes.openapi(
    recordViewRoute,
    (c) => deps.controller.recordView(c, c.req.param("slug")) as never,
  );
  routes.openapi(
    getRoute,
    (c) => deps.controller.getBySlug(c, c.req.param("slug")) as never,
  );
  return routes;
}

export function createAdminPlaceRoutes(deps: {
  controller: PlaceController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();
  routes.use("*", rateLimit({ points: 60, duration: 60 }));
  routes.use(
    "*",
    deps.authenticate,
    authorizeRole("root", "admin", "reviewer"),
  );

  const listRoute = createRoute({
    method: "get",
    path: "/",
    tags: ["Admin Places"],
    summary: "List place (admin/reviewer, semua status)",
    request: { query: listPlacesQuerySchema },
    responses: {
      200: {
        description: "Daftar place",
        content: json(placeListResponseSchema),
      },
      400: {
        description: "Query tidak valid",
        content: json(errorResponseSchema),
      },
    },
  });

  const createRouteDef = createRoute({
    method: "post",
    path: "/",
    tags: ["Admin Places"],
    summary: "Buat place",
    request: {
      body: {
        content: { "application/json": { schema: createPlaceBodySchema } },
      },
    },
    responses: {
      200: {
        description: "Place dibuat",
        content: json(placeItemResponseSchema),
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
    tags: ["Admin Places"],
    summary: "Edit place",
    request: {
      params: idParam,
      body: {
        content: { "application/json": { schema: updatePlaceBodySchema } },
      },
    },
    responses: {
      200: {
        description: "Place diperbarui",
        content: json(placeItemResponseSchema),
      },
      404: {
        description: "Tidak ditemukan",
        content: json(errorResponseSchema),
      },
      409: { description: "Slug bentrok", content: json(errorResponseSchema) },
    },
  });

  const deleteRoute = createRoute({
    method: "delete",
    path: "/:id",
    tags: ["Admin Places"],
    summary: "Soft-delete place",
    request: { params: idParam },
    responses: {
      200: { description: "Terhapus", content: json(okNullResponseSchema) },
      404: {
        description: "Tidak ditemukan",
        content: json(errorResponseSchema),
      },
    },
  });

  const viewPeriodQuery = z.object({
    days: z.coerce.number().int().min(1).max(365).default(30),
  });
  const viewTotalsQuery = z.object({
    days: z.coerce.number().int().min(1).max(365).optional(),
  });
  const viewsResponseSchema = z.object({
    success: z.literal(true),
    data: z.object({
      items: z.array(
        z.object({ place_id: z.string(), views: z.number().int() }),
      ),
    }),
  });
  const viewsRoute = createRoute({
    method: "get",
    path: "/views",
    tags: ["Admin Places"],
    summary: "Total view per place (days kosong = semua waktu)",
    request: { query: viewTotalsQuery },
    responses: {
      200: {
        description: "Total view per place",
        content: json(viewsResponseSchema),
      },
    },
  });
  const viewsDailyRoute = createRoute({
    method: "get",
    path: "/views/daily",
    tags: ["Admin Places"],
    summary: "Tren harian + ranking view per place (halaman analitik)",
    request: { query: viewPeriodQuery },
    responses: {
      200: {
        description: "Laporan view",
        content: json(z.object({ success: z.literal(true) }).passthrough()),
      },
    },
  });

  // Didaftarkan sebelum `/:id` supaya `views` tidak ditelan idParam.
  routes.openapi(
    viewsRoute,
    (c) =>
      deps.controller.listViews(c, c.req.valid("query").days ?? null) as never,
  );
  routes.openapi(
    viewsDailyRoute,
    (c) =>
      deps.controller.listViewsDaily(c, c.req.valid("query").days) as never,
  );
  routes.openapi(
    listRoute,
    (c) => deps.controller.listAdmin(c, c.req.valid("query")) as never,
  );
  routes.openapi(
    createRouteDef,
    (c) => deps.controller.create(c, c.req.valid("json")) as never,
  );
  routes.openapi(
    updateRoute,
    (c) =>
      deps.controller.update(
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
