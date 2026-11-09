import { z } from 'zod';
import { opaqueId } from '@/shared/validation/id';
import {
  JINYE_REPORT_REASONS,
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
