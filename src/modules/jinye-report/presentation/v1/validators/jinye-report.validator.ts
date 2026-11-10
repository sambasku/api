import { z } from 'zod';
import { opaqueId } from '@/shared/validation/id';
import {
  JINYE_REPORT_REASONS,
  JINYE_REPORT_RESOLUTIONS,
  JINYE_REPORT_STATUSES,
  JINYE_REPORT_TARGETS,
} from '@/shared/database/drizzle/schema/jinye-reports.schema';

export const submitJinyeReportBodySchema = z.object({
  target_type: z.enum(JINYE_REPORT_TARGETS),
  target_id: opaqueId,
  reason_code: z.enum(JINYE_REPORT_REASONS),
  note: z
    .string()
    .trim()
    .max(500, 'Catatan maksimal 500 karakter')
    .optional()
    .nullable(),
});

export type SubmitJinyeReportBody = z.infer<typeof submitJinyeReportBodySchema>;

export const createJinyeReportResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    target_type: z.enum(JINYE_REPORT_TARGETS),
    target_id: z.string(),
    reason_code: z.enum(JINYE_REPORT_REASONS),
    status: z.literal('open'),
    created_at: z.string(),
  }),
});

export const listJinyeReportsQuerySchema = z.object({
  status: z.enum(JINYE_REPORT_STATUSES).default('open'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: opaqueId.optional(),
});

export type ListJinyeReportsQuery = z.infer<typeof listJinyeReportsQuerySchema>;

export const resolveJinyeReportBodySchema = z.object({
  resolution: z.enum(JINYE_REPORT_RESOLUTIONS, {
    error: 'Tindakan tidak dikenali',
  }),
  note: z
    .string()
    .trim()
    .min(3, 'Tindakan wajib diisi minimal 3 karakter')
    .max(500, 'Tindakan maksimal 500 karakter')
    .optional(),
});

export type ResolveJinyeReportBody = z.infer<typeof resolveJinyeReportBodySchema>;

export const jinyeReportIdParamSchema = z.object({ id: opaqueId });

export const jinyeReportItemSchema = z.object({
  id: z.string(),
  target_type: z.enum(JINYE_REPORT_TARGETS),
  target_id: z.string(),
  target_body: z.string().nullable(),
  target_has_images: z.boolean(),
  target_has_audio: z.boolean(),
  target_status: z.string().nullable(),
  target_user_id: z.string().nullable(),
  target_username: z.string().nullable(),
  target_display_name: z.string().nullable(),
  user_id: z.string(),
  username: z.string().nullable(),
  display_name: z.string().nullable(),
  reason_code: z.enum(JINYE_REPORT_REASONS),
  note: z.string().nullable(),
  status: z.enum(JINYE_REPORT_STATUSES),
  resolution: z.enum(JINYE_REPORT_RESOLUTIONS).nullable(),
  resolution_note: z.string().nullable(),
  created_at: z.string(),
  resolved_at: z.string().nullable(),
});

export const jinyeReportItemResponseSchema = z.object({
  success: z.literal(true),
  data: jinyeReportItemSchema,
});

export const jinyeReportListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(jinyeReportItemSchema),
  meta: z.object({
    limit: z.number().int(),
    next_cursor: z.string().nullable(),
    has_more: z.boolean(),
  }),
});
