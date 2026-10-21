import { z } from 'zod';
import { choiceId, opaqueId } from '@/shared/validation/id';

const regionTypeSchema = z.enum(['kecamatan', 'desa']);
const regionStatusSchema = z.enum(['draft', 'published', 'archived']);

const sambasLat = z.number().min(1.0).max(1.8).nullable().optional();
const sambasLng = z.number().min(108.5).max(110.0).nullable().optional();

const regionSlugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$/,
    'Slug wilayah hanya huruf kecil, hyphen, dan opsional satu slash untuk desa',
  );

export const createRegionBodySchema = z
  .object({
    slug: regionSlugSchema,
    name: z.string().min(1).max(200),
    type: regionTypeSchema,
    parent_id: choiceId('Kecamatan').nullable().optional(),
    code: z
      .string()
      .regex(/^\d{10}$/, 'Kode BPS harus 10 digit')
      .nullable()
      .optional(),
    lat: sambasLat,
    lng: sambasLng,
    status: regionStatusSchema.optional(),
    sort_order: z.number().int().min(0).max(9999).optional(),
  })
  .strict();

export const updateRegionBodySchema = createRegionBodySchema
  .partial()
  .omit({ slug: true, type: true })
  .strict();

export const listRegionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200),
  before: opaqueId.optional(),
  type: regionTypeSchema.optional(),
  parent_id: opaqueId.optional(),
  q: z.string().max(120).optional(),
  status: regionStatusSchema.optional(),
});

export const regionIdQuerySchema = z.object({
  id: opaqueId,
});

export const regionItemResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    type: regionTypeSchema,
    parent_id: z.string().nullable(),
    code: z.string().nullable(),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
    status: regionStatusSchema,
    sort_order: z.number(),
    created_at: z.number(),
    updated_at: z.number().nullable(),
  }),
});

export const regionCatalogItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: regionTypeSchema,
  parent_id: z.string().nullable(),
  code: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
});

export const regionCatalogResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    regions: z.array(regionCatalogItemSchema),
  }),
});

export const regionListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(regionItemResponseSchema.shape.data),
    next_cursor: z.string().nullable(),
  }),
});
