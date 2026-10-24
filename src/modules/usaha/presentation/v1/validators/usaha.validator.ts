import { z } from 'zod';

export const usahaCategorySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Kategori harus slug di tabel usaha_categories',
  );

export const usahaPublishStatusSchema = z.enum([
  'draft',
  'published',
  'archived',
  'restricted',
]);
export const usahaOperationalStatusSchema = z.enum([
  'unknown',
  'open',
  'temporarily_closed',
  'permanently_closed',
]);
export const usahaKindSchema = z.enum(['product', 'service', 'both']);

function optionalCoord(schema: z.ZodNumber) {
  return z.preprocess(
    (value) =>
      value === '' || value === null || value === undefined ? undefined : value,
    schema.optional(),
  );
}

const sambasLat = optionalCoord(z.number().min(1.0).max(1.8));
const sambasLng = optionalCoord(z.number().min(108.5).max(110.0));

const itemFields = {
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  /** Teks bebas: kosong = belum dicantumkan (bukan gratis). */
  price_text: z.string().max(120).nullable().optional(),
  image_url: z.string().url().startsWith('https://').nullable().optional(),
};

export const usahaItemBodySchema = z.object(itemFields).strict();

// Field body usaha. Dipisah dari refinement supaya `.partial()` legal.
const usahaBodyFields = {
  id: z.string().min(1).max(64).optional(),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug hanya huruf kecil, angka, hyphen'),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(8000).nullable().optional(),
  category_id: usahaCategorySchema.nullable().optional(),
  kind: usahaKindSchema.optional(),
  region_id: z.string().max(64).nullable().optional(),
  village_id: z.string().max(64).nullable().optional(),
  address_text: z.string().max(500).nullable().optional(),
  lat: sambasLat,
  lng: sambasLng,
  maps_url: z.string().url().startsWith('https://').nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  whatsapp: z.string().max(40).nullable().optional(),
  website: z.string().url().startsWith('https://').nullable().optional(),
  social_url: z.string().url().startsWith('https://').nullable().optional(),
  cover_url: z.string().url().startsWith('https://').nullable().optional(),
  publish_status: usahaPublishStatusSchema.optional(),
  operational_status: usahaOperationalStatusSchema.optional(),
};

export const createUsahaBodySchema = z.object(usahaBodyFields).strict();

export const updateUsahaBodySchema = z
  .object(usahaBodyFields)
  .partial()
  .omit({ id: true })
  .strict();

export const listUsahasQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
  before: z.string().min(1).max(64).optional(),
  category_id: usahaCategorySchema.optional(),
  region_id: z.string().max(120).optional(),
  village_id: z.string().max(120).optional(),
  kind: usahaKindSchema.optional(),
  operational_status: usahaOperationalStatusSchema.optional(),
  q: z.string().max(120).optional(),
  status: usahaPublishStatusSchema.optional(),
});

export const usahaCategoryRefSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const usahaVillageRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().nullable(),
});

export const usahaItemResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  price_text: z.string().nullable(),
  image_url: z.string().nullable(),
  sort_order: z.number(),
});

export const usahaResponseSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  category_id: z.string().nullable(),
  category: usahaCategoryRefSchema.nullable(),
  kind: usahaKindSchema,
  region_id: z.string().nullable(),
  village_id: z.string().nullable(),
  village: usahaVillageRefSchema.nullable(),
  address_text: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  maps_url: z.string().nullable(),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  website: z.string().nullable(),
  social_url: z.string().nullable(),
  cover_url: z.string().nullable(),
  publish_status: usahaPublishStatusSchema,
  operational_status: usahaOperationalStatusSchema,
  restricted_reason: z.string().nullable(),
  restricted_at: z.string().nullable(),
  manager_id: z.string().nullable(),
  author_id: z.string().nullable(),
  published_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
  items: z.array(usahaItemResponseSchema).optional(),
});

export const listUsahasResponseSchema = z.object({
  items: z.array(usahaResponseSchema),
  next_cursor: z.string().nullable(),
});

export const usahaCategoryListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(usahaCategoryRefSchema),
  }),
});

export const restrictUsahaBodySchema = z
  .object({
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export const duplicateQuerySchema = z.object({
  usaha_id: z.string().min(1).max(64).optional(),
});
