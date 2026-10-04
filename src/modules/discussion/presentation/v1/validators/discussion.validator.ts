import { z } from 'zod';
import { opaqueId } from '@/shared/validation/id';
import { uploadCredentialsResponseSchema } from '@/modules/image/presentation/v1/validators/image.validator';

export const discussionUploadTokenQuerySchema = z.object({
  folder: z
    .string({ error: 'Folder upload tidak valid' })
    .trim()
    .refine((v) => v === '/discussions', { error: 'Folder upload tidak valid' }),
});

export const discussionImageSchema = z.object({
  url: z.url('Alamat gambar tidak valid'),
  provider_file_id: z
    .string({ error: 'Alamat gambar tidak valid' })
    .trim()
    .min(1, 'Alamat gambar tidak valid'),
});

export const createDiscussionBodySchema = z.object({
  body: z
    .string({ error: 'Deskripsi wajib diisi' })
    .trim()
    .min(1, 'Deskripsi wajib diisi')
    .max(1000, 'Deskripsi maksimal 1000 karakter'),
  /** Opsional; kosong/null = tanpa tautan. Harus https jika diisi. */
  link_url: z
    .string({ error: 'Tautan tidak valid' })
    .trim()
    .max(2048, 'Tautan maksimal 2048 karakter')
    .nullable()
    .optional(),
  images: z
    .array(discussionImageSchema, { error: 'Lampiran tidak boleh lebih dari 4 gambar' })
    .max(4, 'Lampiran tidak boleh lebih dari 4 gambar')
    .optional()
    .default([]),
});

export type CreateDiscussionBody = z.infer<typeof createDiscussionBodySchema>;

export const createDiscussionResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string(),
    status: z.literal('pending_review'),
    submitted_at: z.string(),
  }),
});

export { uploadCredentialsResponseSchema };

export const discussionStatusSchema = z.enum([
  'pending_review',
  'published',
  'rejected',
  'taken_down',
]);

export const listDiscussionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  // latest: ULID; popular: base64url compound (upvotes:id)
  cursor: z.string().min(1).max(200).optional(),
  sort: z.enum(['latest', 'popular']).default('latest'),
});

export type ListDiscussionsQuery = z.infer<typeof listDiscussionsQuerySchema>;

export const listMyDiscussionsQuerySchema = z.object({
  status: discussionStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: opaqueId.optional(),
});

export type ListMyDiscussionsQuery = z.infer<typeof listMyDiscussionsQuerySchema>;

export const listAdminDiscussionsQuerySchema = z.object({
  status: discussionStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: opaqueId.optional(),
});

export type ListAdminDiscussionsQuery = z.infer<typeof listAdminDiscussionsQuerySchema>;

export const discussionIdParamSchema = z.object({
  id: opaqueId,
});

export const discussionReplyIdParamSchema = z.object({
  id: opaqueId,
});

export const createDiscussionReplyBodySchema = z.object({
  body: z
    .string({ error: 'Balasan minimal 1 karakter' })
    .trim()
    .min(1, 'Balasan minimal 1 karakter')
    .max(500, 'Balasan maksimal 500 karakter'),
});

export type CreateDiscussionReplyBody = z.infer<typeof createDiscussionReplyBodySchema>;

export const rejectDiscussionBodySchema = z.object({
  note: z
    .string({ error: 'Alasan penolakan wajib diisi' })
    .trim()
    .min(1, 'Alasan penolakan wajib diisi')
    .max(2000, 'Alasan penolakan maksimal 2000 karakter'),
});

export type RejectDiscussionBody = z.infer<typeof rejectDiscussionBodySchema>;

export const pinDiscussionReplyBodySchema = z.object({
  reply_id: opaqueId,
});

export type PinDiscussionReplyBody = z.infer<typeof pinDiscussionReplyBodySchema>;

const publicImageWireSchema = z.object({
  public_url: z.string(),
  content_warnings: z.array(z.string()).default([]),
});

const ownerImageWireSchema = z.object({
  url: z.string(),
  provider_file_id: z.string(),
  public_url: z.string().nullable(),
  content_warnings: z.array(z.string()).default([]),
});

const adminImageWireSchema = z.object({
  url: z.string(),
  provider_file_id: z.string(),
  public_url: z.string().nullable(),
  content_warnings: z.array(z.string()).default([]),
});

export const discussionReplyPublicSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  username: z.string().nullable(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  body: z.string().nullable(),
  audio_url: z.string().nullable(),
  audio_mime_type: z.string().nullable(),
  audio_duration_ms: z.number().int().nullable(),
  status: z.enum(['published', 'taken_down', 'deleted_by_author']),
  is_verifier: z.boolean(),
  is_pinned: z.boolean(),
  upvotes: z.number().int(),
  downvotes: z.number().int(),
  created_at: z.string(),
});

export const discussionPublicItemSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  username: z.string().nullable(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  body: z.string().nullable(),
  link_url: z.string().nullable(),
  images: z.array(publicImageWireSchema),
  audio_url: z.string().nullable(),
  audio_mime_type: z.string().nullable(),
  audio_duration_ms: z.number().int().nullable(),
  status: z.literal('published'),
  pinned_reply_id: z.string().nullable(),
  upvotes: z.number().int(),
  created_at: z.string(),
});

export const discussionOwnerItemSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  username: z.string().nullable(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  body: z.string().nullable(),
  link_url: z.string().nullable(),
  images: z.array(ownerImageWireSchema),
  audio_url: z.string().nullable(),
  audio_mime_type: z.string().nullable(),
  audio_duration_ms: z.number().int().nullable(),
  status: discussionStatusSchema,
  rejection_note: z.string().nullable(),
  pinned_reply_id: z.string().nullable(),
  reviewed_at: z.string().nullable(),
  upvotes: z.number().int(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
});

export const discussionAdminItemSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  username: z.string().nullable(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  body: z.string().nullable(),
  link_url: z.string().nullable(),
  images: z.array(adminImageWireSchema),
  audio_url: z.string().nullable(),
  audio_mime_type: z.string().nullable(),
  audio_duration_ms: z.number().int().nullable(),
  status: discussionStatusSchema,
  rejection_note: z.string().nullable(),
  reviewed_by: z.string().nullable(),
  reviewed_at: z.string().nullable(),
  pinned_reply_id: z.string().nullable(),
  upvotes: z.number().int(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
});

export const discussionPublicListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(discussionPublicItemSchema),
  meta: z.object({
    limit: z.number().int(),
    next_cursor: z.string().nullable(),
    has_more: z.boolean(),
  }),
});

export const discussionOwnerListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(discussionOwnerItemSchema),
  meta: z.object({
    limit: z.number().int(),
    next_cursor: z.string().nullable(),
    has_more: z.boolean(),
  }),
});

export const discussionAdminListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(discussionAdminItemSchema),
  meta: z.object({
    limit: z.number().int(),
    next_cursor: z.string().nullable(),
    has_more: z.boolean(),
  }),
});

export const discussionPublicDetailResponseSchema = z.object({
  success: z.literal(true),
  data: discussionPublicItemSchema.extend({
    replies: z.array(discussionReplyPublicSchema),
  }),
});

export const discussionOwnerDetailResponseSchema = z.object({
  success: z.literal(true),
  data: discussionOwnerItemSchema.extend({
    replies: z.array(discussionReplyPublicSchema),
  }),
});

export const discussionAdminDetailResponseSchema = z.object({
  success: z.literal(true),
  data: discussionAdminItemSchema.extend({
    replies: z.array(
      discussionReplyPublicSchema.extend({
        body_original: z.string().nullable(),
        is_censored: z.boolean(),
        reviewed_by: z.string().nullable(),
        reviewed_at: z.string().nullable(),
      }),
    ),
  }),
});

export const discussionAdminItemResponseSchema = z.object({
  success: z.literal(true),
  data: discussionAdminItemSchema,
});

export const attachDiscussionAudioResponseSchema = z.object({
  success: z.literal(true),
  data: discussionOwnerItemSchema,
});

export const createDiscussionReplyResponseSchema = z.object({
  success: z.literal(true),
  data: discussionReplyPublicSchema,
});

export const deleteDiscussionReplyResponseSchema = z.object({
  success: z.literal(true),
  data: z.null(),
});
