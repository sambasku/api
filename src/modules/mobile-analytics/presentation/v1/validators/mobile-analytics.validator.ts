import { z } from 'zod';
import { MOBILE_ANALYTICS_SECTIONS } from '../../../domain/entities/mobile-analytics.entity';
import { RANGE_PRESETS } from '@/modules/web-analytics/domain/date-range';
const ymd = (label: string) =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${label} harus berformat YYYY-MM-DD`);
export const mobileAnalyticsParamsSchema = z.object({
  section: z.enum(MOBILE_ANALYTICS_SECTIONS, { message: 'Bagian analitik mobile tidak dikenal' }),
});
export const mobileAnalyticsQuerySchema = z.object({
  range: z.enum(RANGE_PRESETS, { message: 'Rentang harus 7d, 28d, 90d, atau custom' }).default('28d'),
  start: ymd('Tanggal mulai').optional(),
  end: ymd('Tanggal akhir').optional(),
});
export type MobileAnalyticsQuery = z.infer<typeof mobileAnalyticsQuerySchema>;

const dateRangeSchema = z.object({ start: z.string(), end: z.string() });
const mobileResultSchema = z.object({
  status: z.enum(['ok', 'empty', 'not_configured', 'error']),
  errorCode: z.string().nullable(),
  message: z.string().nullable(),
  range: dateRangeSchema.nullable(),
  data: z.record(z.string(), z.unknown()).nullable(),
});

export const mobileAnalyticsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    section: z.enum(MOBILE_ANALYTICS_SECTIONS),
    range: z.object({
      start: z.string(),
      end: z.string(),
      previousStart: z.string(),
      previousEnd: z.string(),
      days: z.number().int().positive(),
    }),
    mobile: mobileResultSchema,
  }),
});