import { z } from 'zod';
import { opaqueId } from '@/shared/validation/id';
import {
  PANTUN_REPORT_REASONS,
  PANTUN_REPORT_RESOLUTIONS,
  PANTUN_REPORT_STATUSES,
  PANTUN_REPORT_TARGETS,
} from '@/shared/database/drizzle/schema/pantun-reports.schema';

export const submitPantunReportBodySchema = z
  .object({
    target_type: z.enum(PANTUN_REPORT_TARGETS, {
      error: 'Jenis target tidak dikenali',
    }),
    target_id: opaqueId,
    reason_code: z.enum(PANTUN_REPORT_REASONS, {
      error: 'Alasan laporan tidak dikenali',
    }),
    note: z
      .string()
      .trim()
      .max(1000, 'Catatan maksimal 1000 karakter')
      .nullish(),
  })
  .superRefine((value, ctx) => {
    if (value.reason_code === 'other' && !value.note?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['note'],
        message: 'Catatan wajib diisi untuk alasan ini',
      });
    }
  });

export type SubmitPantunReportBody = z.infer<typeof submitPantunReportBodySchema>;

export const listPantunReportsQuerySchema = z.object({
  status: z.enum(PANTUN_REPORT_STATUSES).default('open'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: opaqueId.optional(),
});

export type ListPantunReportsQuery = z.infer<typeof listPantunReportsQuerySchema>;

export const resolvePantunReportBodySchema = z.object({
  resolution: z.enum(PANTUN_REPORT_RESOLUTIONS, {
    error: 'Tindakan tidak dikenali',
  }),
  note: z
    .string()
    .trim()
    .min(3, 'Tindakan wajib diisi minimal 3 karakter')
    .max(500, 'Tindakan maksimal 500 karakter')
    .optional(),
});

export type ResolvePantunReportBody = z.infer<typeof resolvePantunReportBodySchema>;

export const pantunReportIdParamSchema = z.object({ id: opaqueId });

export const pantunReportItemSchema = z.object({
  id: z.string(),
  target_type: z.enum(PANTUN_REPORT_TARGETS),
  target_id: z.string(),
  target_lines: z.array(z.string()).nullable(),
  target_status: z.string().nullable(),
  target_user_id: z.string().nullable(),
  target_username: z.string().nullable(),
  target_display_name: z.string().nullable(),
  user_id: z.string(),
  username: z.string().nullable(),
  display_name: z.string().nullable(),
  reason_code: z.enum(PANTUN_REPORT_REASONS),
  note: z.string().nullable(),
  status: z.enum(PANTUN_REPORT_STATUSES),
  resolution: z.enum(PANTUN_REPORT_RESOLUTIONS).nullable(),
  resolution_note: z.string().nullable(),
  created_at: z.string(),
  resolved_at: z.string().nullable(),
});

export const createPantunReportResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string(),
    target_type: z.enum(PANTUN_REPORT_TARGETS),
    target_id: z.string(),
    status: z.literal('open'),
    created_at: z.string(),
  }),
});

export const pantunReportItemResponseSchema = z.object({
  success: z.literal(true),
  data: pantunReportItemSchema,
});

export const pantunReportListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(pantunReportItemSchema),
  meta: z.object({
    limit: z.number().int(),
    next_cursor: z.string().nullable(),
    has_more: z.boolean(),
  }),
});
