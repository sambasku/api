import { z } from 'zod';
import { PHOTO_COMMENT_KINDS } from '@/shared/database/drizzle/schema/photo-comments.schema';
import { entityCommentWireSchema } from '@/shared/comment/entity-comment-response.schema';
import { opaqueId } from '@/shared/validation/id';

export const photoKindSchema = z.enum(PHOTO_COMMENT_KINDS);

export const photoParamsSchema = z.object({
  kind: photoKindSchema,
  ref: z.string().min(1).max(80),
});

export const photoCommentIdParamSchema = z.object({ id: opaqueId });

export const photoCommentsQuerySchema = z.object({
  cursor: opaqueId.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const createPhotoCommentBodySchema = z.object({
  body: z
    .string({ error: 'Komentar wajib diisi' })
    .trim()
    .min(1, 'Komentar wajib diisi')
    .max(1000, 'Komentar maksimal 1000 karakter'),
  parent_id: z
    .string({ error: 'Parent komentar tidak valid' })
    .trim()
    .min(1, 'Parent komentar tidak valid')
    .max(64, 'Parent komentar tidak valid')
    .nullish(),
});

export const updatePhotoCommentBodySchema = z.object({
  body: z
    .string({ error: 'Komentar wajib diisi' })
    .trim()
    .min(1, 'Komentar wajib diisi')
    .max(1000, 'Komentar maksimal 1000 karakter'),
});

export const photoCommentCountsQuerySchema = z.object({
  kind: photoKindSchema,
  refs: z
    .string()
    .min(1)
    .max(2400)
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().min(1).max(80)).min(1).max(50)),
});

export const photoCommentResponseSchema = entityCommentWireSchema.extend({
  id: opaqueId,
  photo_kind: photoKindSchema,
  photo_ref: z.string(),
});
