import { z } from '@hono/zod-openapi';

export const platformSchema = z.enum(['android', 'ios']).openapi('MobileReleasePlatform');

export const semverSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+(?:\+\d+)?$/, 'Must match semver: x.y.z or x.y.z+build')
  .openapi('Semver');

export const getLatestQuerySchema = z
  .object({
    platform: platformSchema,
  })
  .openapi('GetLatestMobileReleaseQuery');

export const listResponseItemSchema = z
  .object({
    id: z.string(),
    platform: platformSchema,
    version: semverSchema,
    store_url: z.string().url().nullable(),
    notes: z.string().nullable(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime().nullable(),
  })
  .openapi('MobileReleaseItem');

export const listResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(listResponseItemSchema),
  })
  .openapi('ListMobileReleasesResponse');

export const getLatestResponseSchema = z
  .object({
    success: z.literal(true),
    data: listResponseItemSchema.nullable(),
  })
  .openapi('GetLatestMobileReleaseResponse');

export const upsertBodySchema = z
  .object({
    version: semverSchema,
    store_url: z.string().url().nullable().optional(),
    notes: z.string().max(500).nullable().optional(),
  })
  .openapi('UpsertMobileReleaseBody');

export const upsertResponseSchema = z
  .object({
    success: z.literal(true),
    data: listResponseItemSchema,
  })
  .openapi('UpsertMobileReleaseResponse');

export type PlatformType = z.infer<typeof platformSchema>;
export type GetLatestQuery = z.infer<typeof getLatestQuerySchema>;
export type UpsertBody = z.infer<typeof upsertBodySchema>;
