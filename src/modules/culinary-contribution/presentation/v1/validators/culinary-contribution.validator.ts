import { z } from 'zod';
import { CULINARY_PLACE_TYPES } from '@/shared/database/drizzle/schema/culinary-places.schema';

function optionalCoord(schema: z.ZodNumber) {
  return z.preprocess(
    (value) =>
      value === '' || value === null || value === undefined ? undefined : value,
    schema.optional(),
  );
}

const sambasLat = optionalCoord(z.number().min(1.0).max(1.8));
const sambasLng = optionalCoord(z.number().min(108.5).max(110.0));

const httpsUrl = z.string().url().startsWith('https://').nullable().optional();

const imageSchema = z
  .object({
    url: z.string().url(),
    is_main: z.boolean().optional(),
    attribution: z
      .object({
        name: z.string().max(200).optional(),
        provider: z.string().max(200).optional(),
        url: z.string().url().optional(),
        license: z.string().max(120).optional(),
        license_url: z.string().url().optional(),
      })
      .strict()
      .nullable()
      .optional(),
  })
  .strict();

const sourceSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    type: z.string().max(60).optional(),
    address: z.string().max(500),
    license: z.string().max(120).nullable().optional(),
    license_url: z.string().url().nullable().optional(),
  })
  .strict();

/** Usulan kuliner baru. Minimum: nama (PRD 7.1). */
export const submitNewCuisineBodySchema = z
  .object({
    kind: z.literal('new_cuisine'),
    payload: z
      .object({
        name: z.string().trim().min(2).max(120),
        description: z.string().max(8000).nullable().optional(),
        category_id: z
          .string()
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
          .nullable()
          .optional(),
        origin_region: z.string().max(120).nullable().optional(),
        images: z.array(imageSchema).max(20).optional(),
        ingredients: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
        serving_suggestion: z.string().max(1000).nullable().optional(),
        tags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
        sources: z.array(sourceSchema).max(20).optional(),
      })
      .strict(),
  })
  .strict();

/** Usulan tempat/penjual baru. Minimum: nama (PRD 7.2). */
export const submitNewPlaceBodySchema = z
  .object({
    kind: z.literal('new_place'),
    payload: z
      .object({
        name: z.string().trim().min(2).max(200),
        type: z.enum(CULINARY_PLACE_TYPES).nullable().optional(),
        description: z.string().max(8000).nullable().optional(),
        location_hint: z.string().max(500).nullable().optional(),
        address_text: z.string().max(500).nullable().optional(),
        lat: sambasLat,
        lng: sambasLng,
        maps_url: httpsUrl,
        phone: z.string().max(40).nullable().optional(),
        whatsapp: z.string().max(40).nullable().optional(),
        website: httpsUrl,
        social_url: httpsUrl,
        cover_url: httpsUrl,
      })
      .strict(),
  })
  .strict();

export const submitCulinaryContributionBodySchema = z.discriminatedUnion('kind', [
  submitNewCuisineBodySchema,
  submitNewPlaceBodySchema,
]);

export const CHANGE_KINDS = [
  'link',
  'cuisine_edit',
  'place_edit',
  'link_edit',
  'place_operational',
  'archive',
  'restore',
] as const;

export const cuisineFieldSchema = z.enum([
  'name',
  'description',
  'categoryId',
  'originRegion',
  'images',
  'ingredients',
  'servingSuggestion',
  'tags',
  'sources',
]);

export const placeFieldSchema = z.enum([
  'name',
  'type',
  'description',
  'locationHint',
  'addressText',
  'lat',
  'lng',
  'mapsUrl',
  'phone',
  'whatsapp',
  'website',
  'socialUrl',
  'coverUrl',
]);

/** Pengajuan perbaikan/hubungan: satu endpoint, payload per kind. */
export const submitCulinaryChangeBodySchema = z
  .object({
    kind: z.enum(CHANGE_KINDS),
    cuisine_id: z.string().min(1).max(64).nullable().optional(),
    place_id: z.string().min(1).max(64).nullable().optional(),
    link_id: z.string().min(1).max(64).nullable().optional(),
    payload: z.record(z.string(), z.unknown()),
    fields: z.array(z.union([cuisineFieldSchema, placeFieldSchema])).max(20).optional(),
  })
  .strict();

export const rejectCulinaryContributionBodySchema = z
  .object({
    reason_code: z.enum([
      'duplicate',
      'incomplete',
      'invalid',
      'unverifiable',
      'attribution',
      'violation',
      'stale',
      'other',
    ]),
    reason_text: z.string().max(1000).nullable().optional(),
  })
  .strict();

export const requestCulinaryRevisionBodySchema = z
  .object({
    note: z.string().trim().min(3).max(1000),
  })
  .strict();
/**
 * Keputusan approve boleh menyunting gambar usulan (hapus/ganti foto warga
 * sebelum tayang). Tanpa body = setujui apa adanya.
 */
export const approveCulinaryContributionBodySchema = z
  .object({
    images: z.array(imageSchema).max(20).optional(),
  })
  .strict();

export const listCulinaryContributionsQuerySchema = z.object({
  status: z
    .enum(['pending', 'needs_revision', 'approved', 'rejected'])
    .optional(),
  kind: z
    .enum([
      'new_cuisine',
      'new_place',
      'link',
      'cuisine_edit',
      'place_edit',
      'link_edit',
      'place_operational',
      'archive',
      'restore',
    ])
    .optional(),
});

export const culinaryContributionResponseSchema = z.object({
  id: z.string(),
  kind: z.string(),
  status: z.string(),
  cuisine_id: z.string().nullable(),
  cuisine_slug: z.string().nullable().optional(),
  cuisine_name: z.string().nullable().optional(),
  place_id: z.string().nullable(),
  place_slug: z.string().nullable().optional(),
  place_name: z.string().nullable().optional(),
  link_id: z.string().nullable(),
  fields: z.array(z.string()),
  payload: z.record(z.string(), z.unknown()),
  result_cuisine_id: z.string().nullable(),
  result_place_id: z.string().nullable(),
  revision_note: z.string().nullable(),
  reject_reason_code: z.string().nullable(),
  reject_reason_text: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
  reviewed_at: z.string().nullable(),
});
