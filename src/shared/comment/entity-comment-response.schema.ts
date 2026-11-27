import { z } from 'zod';
import { IMAGE_CONTENT_WARNINGS } from '@/shared/constants/image-content-warnings';
import { commentImageStatusSchema } from '@/modules/comment/presentation/v1/validators/comment.validator';

const publicEntityCommentImageSchema = z
  .object({
    status: commentImageStatusSchema,
    public_url: z.string().nullable(),
    content_warnings: z.array(z.enum(IMAGE_CONTENT_WARNINGS)),
  })
  .nullable();

const entityCommentBaseWireSchema = z.object({
  id: z.string(),
  parent_id: z.string().nullable().optional(),
  user: z.object({
    user_id: z.string(),
    username: z.string().nullable(),
    display_name: z.string().nullable(),
    avatar_url: z.string().nullable(),
    is_verifier: z.boolean(),
  }),
  body: z.string(),
  sticker_id: z.string().nullable(),
  audio_url: z.string().nullable(),
  audio_mime_type: z.string().nullable(),
  audio_duration_ms: z.number().int().nullable(),
  image: publicEntityCommentImageSchema,
  status: z.enum(['published', 'taken_down', 'deleted_by_author']),
  is_edited: z.boolean(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
});

export const entityCommentWireSchema = entityCommentBaseWireSchema.extend({
  replies: z.array(entityCommentBaseWireSchema).optional(),
});

export const entityCommentEditHistoryResponseSchema = z.object({
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