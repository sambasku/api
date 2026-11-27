import { z } from 'zod';
import { entityCommentWireSchema } from '@/shared/comment/entity-comment-response.schema';
import { opaqueId } from '@/shared/validation/id';

export const karyaCommentsQuerySchema = z.object({
  cursor: opaqueId.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export { entityCommentBodySchema as createKaryaCommentBodySchema } from '@/shared/comment/entity-comment-body.schema';

export const updateKaryaCommentBodySchema = z.object({
  body: z
    .string({ error: 'Komentar wajib diisi' })
    .trim()
    .min(1, 'Komentar wajib diisi')
    .max(1000, 'Komentar maksimal 1000 karakter'),
});

export const karyaCommentResponseSchema = entityCommentWireSchema.extend({
  id: opaqueId,
  karya_id: z.string(),
});
