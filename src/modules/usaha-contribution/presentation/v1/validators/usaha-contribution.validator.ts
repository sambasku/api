import { z } from 'zod';

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

const itemPayloadSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().max(2000).nullable().optional(),
    price_text: z.string().max(120).nullable().optional(),
    image_url: httpsUrl,
  })
  .strict();

/**
 * Usulan usaha baru. Minimum: nama + wilayah (PRD 6.1). Sisa opsional -
 * pemilik mungkin tidak tahu detail, admin bisa melengkapi.
 */
export const submitUsahaContributionBodySchema = z
  .object({
    name: z.string().trim().min(3).max(200),
    region_id: z.string().min(1).max(120),
    description: z.string().max(8000).nullable().optional(),
    category_id: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .nullable()
      .optional(),
    kind: z.enum(['product', 'service', 'both']).optional(),
    village_id: z.string().max(120).nullable().optional(),
    address_text: z.string().max(500).nullable().optional(),
    lat: sambasLat,
    lng: sambasLng,
    phone: z.string().max(40).nullable().optional(),
    whatsapp: z.string().max(40).nullable().optional(),
    website: httpsUrl,
    social_url: httpsUrl,
    cover_url: httpsUrl,
    items: z.array(itemPayloadSchema).max(20).optional(),
    /** "Ini usaha saya" -> klaim pending dibuat saat approve. */
    wants_claim: z.boolean().optional(),
  })
  .strict();

export const CONTRIBUTION_KINDS = [
  'profile',
  'item_add',
  'item_edit',
  'item_delete',
  'operational',
  'archive',
  'restore',
] as const;

export const profileFieldSchema = z.enum([
  'name',
  'description',
  'categoryId',
  'kind',
  'addressText',
  'lat',
  'lng',
  'phone',
  'whatsapp',
  'website',
  'socialUrl',
  'coverUrl',
  'regionId',
  'villageId',
]);

/** Pengajuan pengelola: satu endpoint, payload per kind. */
export const submitManagerChangeBodySchema = z
  .object({
    kind: z.enum(CONTRIBUTION_KINDS),
    usaha_id: z.string().min(1).max(64),
    item_id: z.string().min(1).max(64).nullable().optional(),
    payload: z.record(z.string(), z.unknown()),
    /** Field yang diajukan (kind=profile). Kosong = deteksi dari payload. */
    fields: z.array(profileFieldSchema).max(20).optional(),
  })
  .strict();

export const rejectUsahaContributionBodySchema = z
  .object({
    reason_code: z.enum([
      'duplicate',
      'incomplete',
      'invalid',
      'not_owner',
      'stale',
      'violation',
      'other',
    ]),
    reason_text: z.string().max(1000).nullable().optional(),
  })
  .strict();

export const requestUsahaRevisionBodySchema = z
  .object({
    note: z.string().trim().min(3).max(1000),
  })
  .strict();

export const listUsahaContributionsQuerySchema = z.object({
  status: z
    .enum(['pending', 'needs_revision', 'approved', 'rejected'])
    .optional(),
  kind: z
    .enum([
      'new',
      'profile',
      'item_add',
      'item_edit',
      'item_delete',
      'operational',
      'archive',
      'restore',
    ])
    .optional(),
});

export const usahaContributionResponseSchema = z.object({
  id: z.string(),
  kind: z.string(),
  status: z.string(),
  usaha_id: z.string().nullable(),
  usaha_slug: z.string().nullable().optional(),
  usaha_name: z.string().nullable().optional(),
  item_id: z.string().nullable(),
  fields: z.array(z.string()),
  payload: z.record(z.string(), z.unknown()),
  wants_claim: z.boolean(),
  result_usaha_id: z.string().nullable(),
  revision_note: z.string().nullable(),
  reject_reason_code: z.string().nullable(),
  reject_reason_text: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
  reviewed_at: z.string().nullable(),
});
