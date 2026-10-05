import { z } from 'zod';
import { FCM_ANALYTICS_SECTIONS } from '../../../domain/entities/fcm-analytics.entity';
import { RANGE_PRESETS } from '@/modules/web-analytics/domain/date-range';

const ymd = (label: string) =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${label} harus berformat YYYY-MM-DD`);

export const fcmAnalyticsParamsSchema = z.object({
  section: z.enum(FCM_ANALYTICS_SECTIONS, { message: 'Bagian analitik notifikasi tidak dikenal' }),
});

export const fcmAnalyticsQuerySchema = z.object({
  range: z.enum(RANGE_PRESETS, { message: 'Rentang harus 7d, 28d, 90d, atau custom' }).default('28d'),
  start: ymd('Tanggal mulai').optional(),
  end: ymd('Tanggal akhir').optional(),
});
export type FcmAnalyticsQuery = z.infer<typeof fcmAnalyticsQuerySchema>;

const dateRangeSchema = z.object({ start: z.string(), end: z.string() });

const fcmResultSchema = z.object({
  status: z.enum(['ok', 'empty', 'not_configured', 'error']),
  error_code: z.string().nullable(),
  message: z.string().nullable(),
  range: dateRangeSchema.nullable(),
  // Bentuk data per section: delivery (totals/previous/trend/latest_data_date)
  // dan engagement (totals/previous/trend/avg_engagement_seconds).
  data: z.record(z.string(), z.unknown()).nullable(),
});

export const fcmAnalyticsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    section: z.enum(FCM_ANALYTICS_SECTIONS),
    range: z.object({
      start: z.string(),
      end: z.string(),
      previous_start: z.string(),
      previous_end: z.string(),
      days: z.number().int().positive(),
    }),
    fcm: fcmResultSchema,
  }),
});
