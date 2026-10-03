import { z } from 'zod';
import { PLAY_ANALYTICS_SECTIONS } from '../../../domain/entities/play-analytics.entity';
import { RANGE_PRESETS } from '@/modules/web-analytics/domain/date-range';

const ymd = (label: string) =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${label} harus berformat YYYY-MM-DD`);

export const playAnalyticsParamsSchema = z.object({
  section: z.enum(PLAY_ANALYTICS_SECTIONS, { message: 'Bagian analitik Play tidak dikenal' }),
});

export const playAnalyticsQuerySchema = z.object({
  range: z.enum(RANGE_PRESETS, { message: 'Rentang harus 7d, 28d, 90d, atau custom' }).default('28d'),
  start: ymd('Tanggal mulai').optional(),
  end: ymd('Tanggal akhir').optional(),
});
export type PlayAnalyticsQuery = z.infer<typeof playAnalyticsQuerySchema>;

const dateRangeSchema = z.object({ start: z.string(), end: z.string() });

const playResultSchema = z.object({
  status: z.enum(['ok', 'empty', 'not_configured', 'error']),
  error_code: z.string().nullable(),
  message: z.string().nullable(),
  range: dateRangeSchema.nullable(),
  // Bentuk data per section: lihat docs/env/analitik_api_keys/google_analitik.md.
  data: z.record(z.string(), z.unknown()).nullable(),
});

export const playAnalyticsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    section: z.enum(PLAY_ANALYTICS_SECTIONS),
    range: z.object({
      start: z.string(),
      end: z.string(),
      previous_start: z.string(),
      previous_end: z.string(),
      days: z.number().int().positive(),
    }),
    play: playResultSchema,
  }),
});
