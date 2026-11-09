import { z } from 'zod';
import { opaqueId } from '@/shared/validation/id';
import { uploadCredentialsResponseSchema } from '@/modules/image/presentation/v1/validators/image.validator';

const imageInputSchema = z.object({
  url: z
    .string({ error: 'Alamat gambar tidak valid' })
    .trim()
    .url('Alamat gambar tidak valid'),
  provider_file_id: z
    .string({ error: 'Alamat gambar tidak valid' })
    .trim()
    .min(1, 'Alamat gambar tidak valid'),
});

export const jinyeUploadTokenQuerySchema = z.object({
  folder: z
    .string({ error: 'Folder upload tidak valid' })
    .trim()
    .refine((v) => v === '/jinye', { error: 'Folder upload tidak valid' }),
});

export const createJinyeBodySchema = z.object({
  body: z
    .string({ error: 'Teks tidak valid' })
    .max(500, 'Teks maksimal 500 karakter')
    .optional()
    .nullable(),
  images: z.array(imageInputSchema).max(4, 'Lampiran tidak boleh lebih dari 4 foto').optional(),
  /** Create voice-only: body/images boleh kosong; wajib segera POST /:id/audio. */
  has_pending_audio: z.boolean().optional(),
});

export type CreateJinyeBody = z.infer<typeof createJinyeBodySchema>;

export { uploadCredentialsResponseSchema };

export const jinyeIdParamSchema = z.object({
  id: opaqueId,
});

export const listJinyeQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().trim().min(1).max(512).optional(),
  user_id: opaqueId.optional(),
  /** Alternatif user_id: resolve ke id via username publik. */
  username: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .optional(),
});

export type ListJinyeQuery = z.infer<typeof listJinyeQuerySchema>;

const jinyeImageWireSchema = z.object({
  status: z.enum(['pending_review', 'published']),
  public_url: z.string().nullable(),
  content_warnings: z.array(z.string()),
  /** Hanya owner/admin saat staging. */
  url: z.string().optional(),
  provider_file_id: z.string().optional(),
});

const jinyeAudioWireSchema = z.object({
  audio_url: z.string().nullable(),
  audio_mime_type: z.string().nullable(),
  audio_duration_ms: z.number().nullable(),
});

export const jinyeItemSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  username: z.string().nullable(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  is_verifier: z.boolean(),
  body: z.string().nullable(),
  images: z.array(jinyeImageWireSchema),
  audio: jinyeAudioWireSchema.nullable(),
  status: z.string(),
  comment_count: z.number().int(),
  repost_count: z.number().int(),
  upvotes: z.number().int(),
  downvotes: z.number().int(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
  is_edited: z.boolean(),
});

export const createJinyeResponseSchema = z.object({
  data: jinyeItemSchema,
});

export const listJinyeResponseSchema = z.object({
  data: z.array(jinyeItemSchema),
  meta: z.object({
    next_cursor: z.string().nullable(),
  }),
});

export const jinyeDetailResponseSchema = z.object({
  data: jinyeItemSchema,
});

export const deleteJinyeResponseSchema = z.object({
  data: z.object({ ok: z.literal(true) }),
});

export const createJinyeCommentBodySchema = z.object({
  body: z
    .string({ error: 'Teks tidak valid' })
    .max(500, 'Teks maksimal 500 karakter')
    .optional()
    .nullable(),
  parent_id: opaqueId.optional().nullable(),
  images: z.array(imageInputSchema).max(4, 'Lampiran tidak boleh lebih dari 4 foto').optional(),
});

export type CreateJinyeCommentBody = z.infer<typeof createJinyeCommentBodySchema>;

export const jinyeCommentIdParamSchema = z.object({
  id: opaqueId,
  commentId: opaqueId,
});

const jinyeCommentWireBase = z.object({
  id: z.string(),
  jinye_id: z.string(),
  parent_id: z.string().nullable(),
  user_id: z.string(),
  username: z.string().nullable(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  is_verifier: z.boolean(),
  body: z.string(),
  images: z.array(jinyeImageWireSchema),
  status: z.string(),
  created_at: z.string(),
  upvotes: z.number().int(),
  downvotes: z.number().int(),
});

export const jinyeCommentWireSchema: z.ZodTypeAny = jinyeCommentWireBase.extend({
  replies: z.array(z.lazy(() => jinyeCommentWireSchema)).optional(),
});

export const createJinyeCommentResponseSchema = z.object({
  data: jinyeCommentWireSchema,
});

export const listJinyeCommentsResponseSchema = z.object({
  data: z.array(jinyeCommentWireSchema),
});

export const deleteJinyeCommentResponseSchema = z.object({
  data: z.object({ ok: z.literal(true) }),
});
