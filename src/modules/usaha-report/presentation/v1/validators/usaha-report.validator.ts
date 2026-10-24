import { z } from 'zod';

export const submitReportBodySchema = z
  .object({
    reason_code: z.enum([
      'closed',
      'wrong_location',
      'invalid_contact',
      'misleading',
      'duplicate',
      'abuse',
    ]),
    note: z.string().max(1000).nullable().optional(),
  })
  .strict();

export const reportSlugParamSchema = z.object({ slug: z.string().min(1).max(120) });
export const reportIdParamSchema = z.object({ id: z.string().min(1).max(64) });

export const listReportsQuerySchema = z.object({
  status: z.enum(['open', 'resolved', 'dismissed']).default('open'),
});

export const resolveReportBodySchema = z
  .object({
    status: z.enum(['resolved', 'dismissed']).default('resolved'),
    resolution: z.string().trim().min(3).max(500),
    resolution_note: z.string().max(1000).nullable().optional(),
  })
  .strict();

export const usahaReportSchema = z.object({
  id: z.string(),
  usaha_id: z.string(),
  usaha_slug: z.string().optional(),
  usaha_name: z.string().optional(),
  reason_code: z.string(),
  note: z.string().nullable(),
  status: z.string(),
  resolution: z.string().nullable(),
  resolution_note: z.string().nullable(),
  created_at: z.string(),
  resolved_at: z.string().nullable(),
});
