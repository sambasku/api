import { z } from 'zod';

const httpsUrl = z.string().url().startsWith('https://');

function optionalCoord(schema: z.ZodNumber) {
  return z.preprocess(
    (value) =>
      value === '' || value === null || value === undefined ? undefined : value,
    schema.optional(),
  );
}

/** Koordinat Kabupaten Sambas - tolak titik di luar wilayah. */
const sambasLat = optionalCoord(z.number().min(1.0).max(1.8));
const sambasLng = optionalCoord(z.number().min(108.5).max(110.0));

export const cuisinePublishStatusSchema = z.enum([
  'draft',
  'published',
  'archived',
  'restricted',
]);

export const culinaryPublishStatusSchema = cuisinePublishStatusSchema;

export const culinaryOperationalStatusSchema = z.enum([
  'unknown',
  'operating',
  'temporarily_closed',
  'permanently_closed',
]);

export const culinaryPlaceTypeSchema = z.enum([
  'restaurant',
  'warung',
  'kedai',
  'market_stall',
  'street_vendor',
  'home_industry',
  'other',
]);

export const culinaryAvailabilitySchema = z.enum([
  'unknown',
  'available',
  'seasonal',
  'unavailable',
]);

export const cuisineImageSchema = z
  .object({
    url: httpsUrl,
    is_main: z.boolean().optional(),
    attribution: z
      .object({
        name: z.string().max(200).optional(),
        provider: z.string().max(120).optional(),
        url: httpsUrl.optional(),
        license: z.string().max(120).optional(),
        license_url: httpsUrl.optional(),
      })
      .strict()
      .nullable()
      .optional(),
  })
  .strict();

export const cuisineSourceSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    type: z.string().max(40).optional(),
    address: httpsUrl,
    license: z.string().max(120).nullable().optional(),
    license_url: httpsUrl.nullable().optional(),
  })
  .strict();

/** Field body kuliner (dipakai create admin & patch). */
const cuisineBodyFields = {
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug hanya huruf kecil, angka, hyphen'),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(8000).nullable().optional(),
  category_id: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .nullable()
    .optional(),
  origin_region: z.string().max(160).nullable().optional(),
  images: z.array(cuisineImageSchema).max(20).optional(),
  ingredients: z.array(z.string().trim().min(1).max(120)).max(60).optional(),
  serving_suggestion: z.string().max(1000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  sources: z.array(cuisineSourceSchema).max(20).optional(),
  license: z.string().max(120).nullable().optional(),
  publish_status: cuisinePublishStatusSchema.optional(),
};

export const createCuisineBodySchema = z.object(cuisineBodyFields).strict();

export const updateCuisineBodySchema = z
  .object(cuisineBodyFields)
  .partial()
  .strict();

const placeBodyFields = {
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug hanya huruf kecil, angka, hyphen'),
  name: z.string().trim().min(1).max(200),
  type: culinaryPlaceTypeSchema.nullable().optional(),
  description: z.string().max(8000).nullable().optional(),
  location_hint: z.string().max(300).nullable().optional(),
  address_text: z.string().max(500).nullable().optional(),
  lat: sambasLat,
  lng: sambasLng,
  maps_url: httpsUrl.nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  whatsapp: z.string().max(40).nullable().optional(),
  website: httpsUrl.nullable().optional(),
  social_url: httpsUrl.nullable().optional(),
  cover_url: httpsUrl.nullable().optional(),
  operational_status: culinaryOperationalStatusSchema.optional(),
  publish_status: culinaryPublishStatusSchema.optional(),
};

export const createPlaceBodySchema = z.object(placeBodyFields).strict();
export const updatePlaceBodySchema = z.object(placeBodyFields).partial().strict();

export const createLinkBodySchema = z
  .object({
    cuisine_id: z.string().min(1).max(64),
    place_id: z.string().min(1).max(64),
    availability: culinaryAvailabilitySchema.optional(),
    note: z.string().max(500).nullable().optional(),
    publish_status: culinaryPublishStatusSchema.optional(),
  })
  .strict();

export const updateLinkBodySchema = z
  .object({
    availability: culinaryAvailabilitySchema.optional(),
    note: z.string().max(500).nullable().optional(),
    publish_status: culinaryPublishStatusSchema.optional(),
  })
  .strict();

export const listCuisinesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
  before: z.string().min(1).max(64).optional(),
  category_id: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  q: z.string().max(120).optional(),
  status: cuisinePublishStatusSchema.optional(),
});

export const listPlacesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
  before: z.string().min(1).max(64).optional(),
  type: culinaryPlaceTypeSchema.optional(),
  operational_status: culinaryOperationalStatusSchema.optional(),
  q: z.string().max(120).optional(),
  status: culinaryPublishStatusSchema.optional(),
});

export const duplicatesQuerySchema = z.object({
  q: z.string().trim().min(1).max(120),
  exclude_id: z.string().max(64).optional(),
});

export const restrictBodySchema = z
  .object({ reason: z.string().trim().min(3).max(500) })
  .strict();

// ------------------------------------------------------------- respons --

export const culinaryCategoryRefSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const cuisineImageResponseSchema = z.object({
  url: z.string(),
  is_main: z.boolean(),
  attribution: z
    .object({
      name: z.string().optional(),
      provider: z.string().optional(),
      url: z.string().optional(),
      license: z.string().optional(),
      license_url: z.string().optional(),
    })
    .nullable(),
});

export const cuisineSourceResponseSchema = z.object({
  name: z.string(),
  type: z.string(),
  address: z.string(),
  license: z.string().nullable(),
  license_url: z.string().nullable(),
});

export const cuisinePlaceLinkSchema = z.object({
  id: z.string(),
  cuisine_id: z.string(),
  place_id: z.string(),
  availability: culinaryAvailabilitySchema,
  note: z.string().nullable(),
  cuisine_name: z.string().nullable(),
  cuisine_slug: z.string().nullable(),
  place_name: z.string().nullable(),
  place_slug: z.string().nullable(),
});

export const cuisineResponseSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  category_id: z.string().nullable(),
  category: culinaryCategoryRefSchema.nullable(),
  origin_region: z.string().nullable(),
  images: z.array(cuisineImageResponseSchema),
  ingredients: z.array(z.string()),
  serving_suggestion: z.string().nullable(),
  tags: z.array(z.string()),
  sources: z.array(cuisineSourceResponseSchema),
  license: z.string().nullable(),
  publish_status: cuisinePublishStatusSchema,
  restricted_reason: z.string().nullable(),
  restricted_at: z.string().nullable(),
  author_id: z.string().nullable(),
  published_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
  places: z.array(cuisinePlaceLinkSchema).optional(),
});

export const culinaryPlaceResponseSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  type: culinaryPlaceTypeSchema.nullable(),
  description: z.string().nullable(),
  location_hint: z.string().nullable(),
  address_text: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  maps_url: z.string().nullable(),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  website: z.string().nullable(),
  social_url: z.string().nullable(),
  cover_url: z.string().nullable(),
  operational_status: culinaryOperationalStatusSchema,
  publish_status: culinaryPublishStatusSchema,
  restricted_reason: z.string().nullable(),
  restricted_at: z.string().nullable(),
  manager_id: z.string().nullable(),
  author_id: z.string().nullable(),
  published_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
  cuisines: z.array(cuisinePlaceLinkSchema).optional(),
});

export const cuisineListResponseSchema = z.object({
  items: z.array(cuisineResponseSchema),
  next_cursor: z.string().nullable(),
});

export const placeListResponseSchema = z.object({
  items: z.array(culinaryPlaceResponseSchema),
  next_cursor: z.string().nullable(),
});

export const culinaryCategoryListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ items: z.array(culinaryCategoryRefSchema) }),
});

export const duplicateCandidateListSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(
      z.object({ id: z.string(), slug: z.string(), name: z.string() }),
    ),
  }),
});
