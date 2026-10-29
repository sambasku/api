import { z } from 'zod';
import { uploadCredentialsResponseSchema } from '@/modules/image/presentation/v1/validators/image.validator';
import { IMAGE_CONTENT_WARNINGS } from '@/shared/constants/image-content-warnings';

export const commentImageInputSchema = z.object({
  url: z.url('Alamat gambar tidak valid'),
  provider_file_id: z
    .string({ error: 'Alamat gambar tidak valid' })
    .trim()
    .min(1, 'Alamat gambar tidak valid'),
});

/** Create: teks dan/atau satu foto staging (opsi B). */
export const commentBodySchema = z
  .object({
    body: z
      .string({ error: 'Komentar tidak valid' })
      .trim()
      .max(1000, 'Komentar maksimal 1000 karakter')
      .optional()
      .default(''),
    image: commentImageInputSchema.optional(),
  })
  .superRefine((val, ctx) => {
    const hasBody = (val.body?.trim().length ?? 0) > 0;
    if (!hasBody && !val.image) {
      ctx.addIssue({
        code: 'custom',
        path: ['body'],
        message: 'Komentar atau foto wajib diisi',
      });
    }
  });

export type CreateCommentBody = z.infer<typeof commentBodySchema>;

export const attachCommentImageBodySchema = commentImageInputSchema;

export type AttachCommentImageBody = z.infer<typeof attachCommentImageBodySchema>;

export const commentUploadTokenQuerySchema = z.object({
  folder: z
    .string({ error: 'Folder upload tidak valid' })
    .trim()
    .refine((v) => v === '/comments', { error: 'Folder upload tidak valid' }),
});

export { uploadCredentialsResponseSchema };

export const commentStatusSchema = z.enum(['published', 'taken_down', 'deleted_by_author']);

export const commentImageStatusSchema = z.enum(['pending_review', 'published', 'rejected']);

export const listCommentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().length(26).optional(),
});

export type ListCommentsQueryBody = z.infer<typeof listCommentsQuerySchema>;

export const listAdminCommentsQuerySchema = z.object({
  status: commentStatusSchema.optional(),
  word_id: z.string().length(26).optional(),
  image_status: commentImageStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().length(26).optional(),
});

export type ListAdminCommentsQueryBody = z.infer<typeof listAdminCommentsQuerySchema>;

/** Wire publik: staging URL tidak diekspos. */
const publicCommentImageSchema = z
  .object({
    status: commentImageStatusSchema,
    public_url: z.string().nullable(),
    content_warnings: z.array(z.enum(IMAGE_CONTENT_WARNINGS)),
  })
  .nullable();

const commentDataSchema = z.object({
  id: z.string(),
  word_id: z.string(),
  word_lemma: z.string().nullable(),
  user_id: z.string(),
  username: z.string().nullable(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  is_verifier: z.boolean(),
  body: z.string().nullable(),
  audio_url: z.string().nullable(),
  audio_mime_type: z.string().nullable(),
  audio_duration_ms: z.number().int().nullable(),
  image: publicCommentImageSchema,
  status: commentStatusSchema,
  is_edited: z.boolean(),
  updated_at: z.string().nullable(),
  created_at: z.string(),
});

export const updateCommentBodySchema = z.object({
  body: z
    .string({ error: 'Komentar tidak valid' })
    .trim()
    .max(1000, 'Komentar maksimal 1000 karakter'),
});

export type UpdateCommentBody = z.infer<typeof updateCommentBodySchema>;

export const updateCommentResponseSchema = z.object({
  success: z.literal(true),
  data: commentDataSchema,
});

export const commentEditHistoryResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    current: z.object({
      body: z.string().nullable(),
      updated_at: z.string().nullable(),
      is_edited: z.boolean(),
    }),
    revisions: z.array(
      z.object({
        body: z.string(),
        editor_id: z.string(),
        created_at: z.string(),
      }),
    ),
  }),
});

export const createCommentResponseSchema = z.object({
  success: z.literal(true),
  data: commentDataSchema,
});

const cursorMetaSchema = z.object({
  limit: z.number().int(),
  next_cursor: z.string().nullable(),
  has_more: z.boolean(),
});

export const listCommentsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(commentDataSchema.extend({ upvotes: z.number().int(), downvotes: z.number().int() })),
  meta: cursorMetaSchema,
});

const adminCommentImageSchema = z
  .object({
    status: commentImageStatusSchema,
    url: z.string().nullable(),
    provider: z.string().nullable(),
    provider_file_id: z.string().nullable(),
    public_url: z.string().nullable(),
    content_warnings: z.array(z.string()),
    reviewed_by: z.string().nullable(),
    reviewed_at: z.string().nullable(),
  })
  .nullable();

export const adminListCommentsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(
    commentDataSchema.extend({
      body: z.string(),
      body_original: z.string().nullable(),
      is_censored: z.boolean(),
      reviewed_by: z.string().nullable(),
      reviewed_at: z.string().nullable(),
      image: adminCommentImageSchema,
    }),
  ),
  meta: cursorMetaSchema,
});

export const approveCommentImageBodySchema = z.object({
  content_warnings: z.array(z.enum(IMAGE_CONTENT_WARNINGS)).optional().default([]),
});

export type ApproveCommentImageBody = z.infer<typeof approveCommentImageBodySchema>;

export const rejectCommentImageBodySchema = z.object({
  abusive: z.boolean().optional().default(false),
});

export type RejectCommentImageBody = z.infer<typeof rejectCommentImageBodySchema>;

export const approveCommentImageResponseSchema = z.object({
  success: z.literal(true),
  data: commentDataSchema,
});

export const rejectCommentImageResponseSchema = z.object({
  success: z.literal(true),
  data: commentDataSchema,
});

export const takedownCommentResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string(),
    status: z.literal('taken_down'),
    reviewed_by: z.string(),
    reviewed_at: z.string(),
  }),
});

export const uncensorCommentResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string(),
    body: z.string(),
    body_original: z.null(),
    is_censored: z.literal(false),
  }),
});

export const listMyCommentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().length(26).optional(),
  status: commentStatusSchema.optional(),
});

export type ListMyCommentsQueryBody = z.infer<typeof listMyCommentsQuerySchema>;

export const myCommentsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(
    z.object({
      id: z.string(),
      word_id: z.string(),
      word_lemma: z.string().nullable(),
      body: z.string(),
      status: commentStatusSchema,
      created_at: z.string(),
      reviewed_at: z.string().nullable(),
    }),
  ),
  meta: cursorMetaSchema,
});
