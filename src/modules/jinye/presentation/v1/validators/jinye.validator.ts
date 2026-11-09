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
  /** Jinye yang menaut lemma ini (link active / pending_correction). */
  word_id: opaqueId.optional(),
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
  repost_of_id: z.string().nullable(),
  quote_body: z.string().nullable(),
  status: z.string(),
  comment_count: z.number().int(),
  repost_count: z.number().int(),
  upvotes: z.number().int(),
  downvotes: z.number().int(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
  is_edited: z.boolean(),
  is_pinned: z.boolean().optional(),
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
  data: jinyeItemSchema.extend({
    lemma_links: z.array(z.any()).optional(),
  }),
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

export const createJinyeLemmaLinkBodySchema = z.object({
  start: z.coerce.number().int().min(0),
  end: z.coerce.number().int().min(1),
  word_id: opaqueId,
});
export type CreateJinyeLemmaLinkBody = z.infer<
  typeof createJinyeLemmaLinkBodySchema
>;

export const proposeJinyeLemmaCorrectionBodySchema = z.object({
  word_id: opaqueId,
});
export type ProposeJinyeLemmaCorrectionBody = z.infer<
  typeof proposeJinyeLemmaCorrectionBodySchema
>;

export const resolveJinyeLemmaCorrectionBodySchema = z.object({
  action: z.enum(['approve', 'reject']),
});
export type ResolveJinyeLemmaCorrectionBody = z.infer<
  typeof resolveJinyeLemmaCorrectionBodySchema
>;

export const jinyeLemmaLinkIdParamSchema = z.object({
  id: opaqueId,
  linkId: opaqueId,
});

export const jinyeLemmaLinkWireSchema = z.object({
  id: z.string(),
  jinye_id: z.string().nullable(),
  comment_id: z.string().nullable(),
  start: z.number().int(),
  end: z.number().int(),
  word_id: z.string(),
  lemma: z.string().nullable(),
  status: z.string(),
  source: z.string(),
  proposed_word_id: z.string().nullable(),
  proposed_lemma: z.string().nullable(),
  proposed_by: z.string().nullable(),
  created_at: z.string(),
});

export const jinyeLemmaLinkResponseSchema = z.object({
  data: jinyeLemmaLinkWireSchema,
});

export const listJinyeLemmaLinksResponseSchema = z.object({
  data: z.array(jinyeLemmaLinkWireSchema),
});

export const promoteJinyeExampleBodySchema = z.object({
  word_id: opaqueId,
  meaning_id: opaqueId.optional(),
  include_audio: z.boolean().optional(),
  target_sentence: z.string().trim().max(1000).optional(),
});
export type PromoteJinyeExampleBody = z.infer<
  typeof promoteJinyeExampleBodySchema
>;

export const promoteJinyeExampleResponseSchema = z.object({
  data: z.object({
    example_id: z.string(),
    word_audio_id: z.string().nullable(),
    status: z.string(),
    is_verified: z.boolean(),
  }),
});

export const createJinyeTranslationBodySchema = z.object({
  body_id: z.string().trim().min(1).max(1000),
});
export type CreateJinyeTranslationBody = z.infer<
  typeof createJinyeTranslationBodySchema
>;

export const resolveJinyeTranslationBodySchema = z.object({
  action: z.enum(['approve', 'reject']),
});
export type ResolveJinyeTranslationBody = z.infer<
  typeof resolveJinyeTranslationBodySchema
>;

export const jinyeTranslationIdParamSchema = z.object({
  id: opaqueId,
  translationId: opaqueId,
});

export const jinyeTranslationWireSchema = z.object({
  id: z.string(),
  jinye_id: z.string(),
  body_id: z.string(),
  status: z.string(),
  translator_id: z.string(),
  reviewed_by: z.string().nullable(),
  reviewed_at: z.string().nullable(),
  created_at: z.string(),
});

export const jinyeTranslationResponseSchema = z.object({
  data: jinyeTranslationWireSchema,
});

export const listJinyeTranslationsResponseSchema = z.object({
  data: z.array(jinyeTranslationWireSchema),
});

export const updateJinyeBodySchema = z.object({
  body: z
    .string({ error: 'Teks tidak valid' })
    .max(500, 'Teks maksimal 500 karakter'),
});
export type UpdateJinyeBody = z.infer<typeof updateJinyeBodySchema>;

export const jinyeEditHistoryResponseSchema = z.object({
  data: z.object({
    current: z.object({
      body: z.string(),
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

export const quoteJinyeBodySchema = z.object({
  quote_body: z
    .string({ error: 'Kutipan tidak valid' })
    .trim()
    .min(1, 'Tulis kutipan dulu ya.')
    .max(500, 'Kutipan maksimal 500 karakter'),
});
export type QuoteJinyeBody = z.infer<typeof quoteJinyeBodySchema>;
