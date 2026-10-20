import { z } from 'zod';

const placeCategorySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Kategori harus slug di tabel place_categories');
const placeTypeSchema = z.enum(['sejarah', 'alam', 'budaya', 'pantai', 'belanja']);
const placeStatusSchema = z.enum(['draft', 'published', 'archived']);

const attributionSchema = z
  .object({
    name: z.string().min(1).max(200),
    provider: z.string().max(64).optional(),
    url: z.string().url().startsWith('https://').nullable().optional(),
    license: z.string().max(128).nullable().optional(),
    license_url: z.string().url().startsWith('https://').nullable().optional(),
    source: z.string().max(128).nullable().optional(),
    authorId: z.string().max(64).nullable().optional(),
  })
  .strict();

const imageSchema = z.object({
  url: z.string().url().startsWith('https://'),
  is_main: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
  attribution: attributionSchema.nullable().optional(),
});

const sourceSchema = z.object({
  name: z.string().min(1).max(300),
  type: z.string().min(1).max(64).default('other'),
  address: z.string().min(1).max(2000),
  license: z.string().max(200).nullable().optional(),
  license_url: z.string().url().startsWith('https://').nullable().optional(),
});

export const placeRelationSchema = z.object({
  kind: z.enum(['place', 'usaha']),
  slug: z.string().min(1).max(120),
});

const sambasLat = z.number().min(1.0).max(1.8).nullable().optional();
const sambasLng = z.number().min(108.5).max(110.0).nullable().optional();

export const createPlaceBodySchema = z
  .object({
    id: z.string().min(1).max(64).optional(),
    slug: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug hanya huruf kecil, angka, hyphen'),
    name: z.string().min(1).max(200),
    category: placeCategorySchema,
    type: placeTypeSchema.nullable().optional(),
    lat: sambasLat,
    lng: sambasLng,
    maps_url: z.string().url().startsWith('https://').nullable().optional(),
    short_description: z.string().min(1).max(4000),
    region_id: z.string().max(64).nullable().optional(),
    village_id: z.string().max(64).nullable().optional(),
    hours: z.string().max(500).nullable().optional(),
    contact: z.string().max(500).nullable().optional(),
    author_id: z.string().max(64).nullable().optional(),
    sources: z.array(sourceSchema).max(20).optional(),
    related: z.array(placeRelationSchema).max(20).optional(),
    images: z.array(imageSchema).optional(),
    status: placeStatusSchema.optional(),
  })
  .strict();

export const updatePlaceBodySchema = createPlaceBodySchema.partial().omit({ id: true }).strict();

export const listPlacesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
  before: z.string().min(1).max(64).optional(),
  category: placeCategorySchema.optional(),
  type: placeTypeSchema.optional(),
  region_id: z.string().max(64).optional(),
  village_id: z.string().max(64).optional(),
  /** "1" = hanya place yang belum punya desa. */
  village_unset: z.literal('1').optional(),
  q: z.string().max(120).optional(),
  status: placeStatusSchema.optional(),
});

const placeImageResponseSchema = z.object({
  id: z.string(),
  url: z.string(),
  is_main: z.boolean(),
  sort_order: z.number(),
  attribution: z
    .object({
      name: z.string(),
      provider: z.string().optional(),
      url: z.string().nullable().optional(),
      license: z.string().nullable().optional(),
      license_url: z.string().nullable().optional(),
      source: z.string().nullable().optional(),
      authorId: z.string().nullable().optional(),
    })
    .nullable(),
});

export const placeItemResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    category: placeCategorySchema,
    type: placeTypeSchema.nullable(),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
    maps_url: z.string().nullable(),
    short_description: z.string(),
    region_id: z.string().nullable(),
    village_id: z.string().nullable(),
    hours: z.string().nullable(),
    contact: z.string().nullable(),
    author_id: z.string().nullable(),
    sources: z.array(
      z.object({
        name: z.string(),
        type: z.string(),
        address: z.string(),
        license: z.string().nullable().optional(),
        license_url: z.string().nullable().optional(),
      }),
    ),
    related: z.array(
      z.object({
        kind: z.enum(['place', 'usaha']),
        slug: z.string(),
        name: z.string().nullable(),
        category: z.string().nullable(),
        type: placeTypeSchema.nullable(),
        cover_url: z.string().nullable(),
      }),
    ),
    image_count: z.number(),
    images: z.array(placeImageResponseSchema),
    status: placeStatusSchema,
    created_at: z.number(),
    updated_at: z.number().nullable(),
  }),
});

export const placeListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(placeItemResponseSchema.shape.data),
    next_cursor: z.string().nullable(),
  }),
});
