import { z } from 'zod';
import { WEB_ANALYTICS_SECTIONS } from '../../../domain/entities/web-analytics.entity';
import { RANGE_PRESETS } from '../../../domain/date-range';

const ymd = (label: string) =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${label} harus berformat YYYY-MM-DD`);

export const webAnalyticsParamsSchema = z.object({
  section: z.enum(WEB_ANALYTICS_SECTIONS, { message: 'Bagian analitik tidak dikenal' }),
});

export const webAnalyticsQuerySchema = z.object({
  range: z.enum(RANGE_PRESETS, { message: 'Rentang harus 7d, 28d, 90d, atau custom' }).default('28d'),
  start: ymd('Tanggal mulai').optional(),
  end: ymd('Tanggal akhir').optional(),
  // Filter Search Console (hanya section `search`), cocok sebagian.
  page: z.string().trim().max(200, 'Filter halaman maksimal 200 karakter').optional(),
  query: z.string().trim().max(200, 'Filter kata kunci maksimal 200 karakter').optional(),
});

export type WebAnalyticsQuery = z.infer<typeof webAnalyticsQuerySchema>;

const dateRangeSchema = z.object({ start: z.string(), end: z.string() });

const providerResultSchema = z.object({
  status: z.enum(['ok', 'empty', 'not_configured', 'error']),
  error_code: z.string().nullable(),
  message: z.string().nullable(),
  range: dateRangeSchema.nullable(),
  // Bentuk data per section: lihat docs/backlogs/ANALITIK_GOOGLE.md.
  data: z.record(z.string(), z.unknown()).nullable(),
});

export const webAnalyticsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    section: z.enum(WEB_ANALYTICS_SECTIONS),
    range: z.object({
      start: z.string(),
      end: z.string(),
      previous_start: z.string(),
      previous_end: z.string(),
      days: z.number().int().positive(),
    }),
    ga4: providerResultSchema.optional(),
    search_console: providerResultSchema.optional(),
  }),
});
