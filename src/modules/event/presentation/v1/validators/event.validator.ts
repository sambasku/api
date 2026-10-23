import { z } from "zod";
import { opaqueId } from "@/shared/validation/id";

export const eventCategorySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Kategori harus slug di tabel event_categories",
  );

export const eventStatusSchema = z.enum(["draft", "published", "archived"]);

export const eventSourceTypeSchema = z.enum([
  "facebook",
  "instagram",
  "website",
  "tiktok",
  "youtube",
  "whatsapp",
  "other",
]);

function optionalCoord(schema: z.ZodNumber) {
  return z.preprocess(
    (value) =>
      value === "" || value === null || value === undefined ? undefined : value,
    schema.optional(),
  );
}

const sambasLat = optionalCoord(z.number().min(1.0).max(1.8));
const sambasLng = optionalCoord(z.number().min(108.5).max(110.0));

// Field body event. Dipisah dari refinement supaya `.partial()` legal
// (zod v4: object dengan refinement tidak bisa di-partial).
const eventBodyFields = {
  id: z.string().min(1).max(64).optional(),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug hanya huruf kecil, angka, hyphen",
    ),
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(8000),
  category_id: eventCategorySchema,
  starts_at: z.coerce.date(),
  ends_at: z.coerce.date(),
  location_text: z.string().min(1).max(500),
  lat: sambasLat,
  lng: sambasLng,
  maps_url: z.string().url().startsWith("https://").nullable().optional(),
  poster_urls: z
    .array(z.string().url().startsWith("https://"))
    .max(10)
    .optional(),

  organizer: z.string().max(200).nullable().optional(),
  /** Link original konten (FB/IG/website). Disimpan BERSIH tanpa UTM. */
  source_url: z.string().url().startsWith("https://").nullable().optional(),
  source_type: eventSourceTypeSchema.nullable().optional(),
  source_attribution: z.string().max(300).nullable().optional(),
  region_id: z.string().max(64).nullable().optional(),
  village_id: z.string().max(64).nullable().optional(),
  place_ids: z.array(opaqueId).max(20).optional(),
  author_id: z.string().max(64).nullable().optional(),
  status: eventStatusSchema.optional(),
};

export const createEventBodySchema = z
  .object(eventBodyFields)
  .strict()
  .superRefine((v, ctx) => {
    if (v.ends_at.getTime() < v.starts_at.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Waktu selesai tidak boleh sebelum waktu mulai",
        path: ["ends_at"],
      });
    }
  });

export const updateEventBodySchema = z
  .object(eventBodyFields)
  .partial()
  .omit({ id: true })
  .strict()
  .superRefine((v, ctx) => {
    // Hanya bisa dibandingkan kalau keduanya dikirim; kalau tidak, use-case
    // membandingkan dengan nilai lama (endsAt < startsAt).
    if (
      v.starts_at &&
      v.ends_at &&
      v.ends_at.getTime() < v.starts_at.getTime()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Waktu selesai tidak boleh sebelum waktu mulai",
        path: ["ends_at"],
      });
    }
  });

export const listEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
  before: z.string().min(1).max(64).optional(),
  category_id: eventCategorySchema.optional(),
  village_id: z.string().max(64).optional(),
  place_id: z.string().max(64).optional(),
  q: z.string().max(120).optional(),
  status: eventStatusSchema.optional(),
  /** "1" = hanya acara yang belum selesai. */
  not_ended: z.literal("1").optional(),
  /** Urutan: "asc" = paling dekat dulu, "desc" = terbaru dulu. */
  order: z.enum(["asc", "desc"]).optional(),
});

export const eventPlaceRefSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  category: z.string().nullable(),
});

export const eventCategoryRefSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const eventVillageRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().nullable(),
});

export const eventCategoryListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(eventCategoryRefSchema),
  }),
});

export const eventResponseSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  category_id: z.string(),
  category: eventCategoryRefSchema.nullable(),
  starts_at: z.string(),
  ends_at: z.string(),
  /** Status pelaksanaan - diturunkan read-time, tidak disimpan. */
  occurrence_status: z.enum([
    "upcoming",
    "ongoing",
    "completed",
    "cancelled",
  ]),
  location_text: z.string(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  maps_url: z.string().nullable(),
  poster_urls: z.array(z.string().nullable()),
  organizer: z.string().nullable(),
  source_url: z.string().nullable(),
  source_type: eventSourceTypeSchema.nullable(),
  source_attribution: z.string().nullable(),
  region_id: z.string().nullable(),
  village_id: z.string().nullable(),
  village: eventVillageRefSchema.nullable(),
  places: z.array(eventPlaceRefSchema),
  status: eventStatusSchema,
  cancelled_at: z.string().nullable(),
  published_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
});

export const listEventsResponseSchema = z.object({
  items: z.array(eventResponseSchema),
  next_cursor: z.string().nullable(),
});

export const cancelEventBodySchema = z
  .object({
    cancelled: z.boolean().default(true),
  })
  .strict();
