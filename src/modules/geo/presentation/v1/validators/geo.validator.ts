import { z } from 'zod';

export const resolveMapsUrlBodySchema = z.object({
  url: z
    .string()
    .trim()
    .min(12, 'Tautan terlalu pendek')
    .max(2048, 'Tautan terlalu panjang'),
  /** True untuk wisata: titik di luar Kab. Sambas ditolak. Default false. */
  require_sambas_bounds: z.boolean().optional().default(false),
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
