import { z } from 'zod';

// #124: action_url = URL https valid apa pun host-nya (kebijakan konten
// admin, bukan teknis). Deep link in-app vs eksternal dibedakan di client.
// Refine: https + parseable. Host lock dihapus.
export function actionUrlSchema() {
  return z
    .string()
    .trim()
    .url('URL action harus URL valid')
    .max(2048)
    .refine((v) => {
      try {
        const url = new URL(v);
        return url.protocol === 'https:';
      } catch {
        return false;
      }
    }, 'URL action wajib https');
}

// #124 lanjutan: format isi pengumuman. webview = client load isi body.
export const bodyTypeSchema = z.enum(['plain', 'html', 'md', 'webview']);

export const createAnnouncementBodySchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    body: z.string().trim().min(3).max(5000),
    body_type: bodyTypeSchema.default('plain'),
    action_url: actionUrlSchema().nullable().optional(),
    action_label: z.string().trim().min(2).max(40).nullable().optional(),
    expires_at: z.number().int().positive().nullable().optional(),
    pinned_at: z
      .number()
      .int()
      .positive()
      .nullable()
      .optional()
  })
  .superRefine((v, ctx) => {
    if (v.action_label != null && (v.action_url == null || v.action_url === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['action_label'],
        message: 'action_label butuh action_url',
      });
    }
  });

export const updateAnnouncementBodySchema = z
  .object({
    title: z.string().trim().min(3).max(120).optional(),
    body: z.string().trim().min(3).max(5000).optional(),
    body_type: bodyTypeSchema.optional(),
    action_url: actionUrlSchema().nullable().optional(),
    action_label: z.string().trim().min(2).max(40).nullable().optional(),
    expires_at: z.number().int().positive().nullable().optional(),
    pinned_at: z
      .number()
      .int()
      .positive()
      .nullable()
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (v.action_label != null && v.action_url === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['action_label'],
        message: 'action_label butuh action_url',
      });
    }
  });

export const listAnnouncementsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  before: z.string().length(26).optional(),
});

const announcementItemSchema = z.object({
  id: z.string().length(26),
  title: z.string(),
  body: z.string(),
  body_type: bodyTypeSchema,
  action_url: z.string().nullable(),
  action_label: z.string().nullable(),
  created_by: z.string(),
  expires_at: z.number().int().nullable(),
  pinned_at: z.number().int().nullable(),
  expired: z.boolean(),
  created_at: z.number().int(),
  updated_at: z.number().int().nullable(),
});

export const announcementItemResponseSchema = z.object({
  success: z.literal(true),
  data: announcementItemSchema,
});

export const announcementListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(announcementItemSchema),
    next_cursor: z.string().nullable(),
  }),
});
