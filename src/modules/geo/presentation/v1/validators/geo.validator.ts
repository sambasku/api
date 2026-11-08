import { z } from 'zod';

export const resolveMapsUrlBodySchema = z.object({
  url: z
    .string()
    .trim()
    .min(12, 'Tautan terlalu pendek')
    .max(2048, 'Tautan terlalu panjang'),
});

export type ResolveMapsUrlBody = z.infer<typeof resolveMapsUrlBodySchema>;

export const resolveMapsUrlResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    lat: z.number(),
    lng: z.number(),
    canonical_url: z.string().url(),
  }),
});
