import { z } from 'zod';
import { commentImageInputSchema } from '@/modules/comment/presentation/v1/validators/comment.validator';

/** Create komentar entitas (wisata/usaha/kuliner/acara): teks dan/atau foto dan/atau stiker. */
export const entityCommentBodySchema = z
  .object({
    body: z
      .string({ error: 'Komentar tidak valid' })
      .trim()
      .max(1000, 'Komentar maksimal 1000 karakter')
      .optional()
      .default(''),
    image: commentImageInputSchema.nullish(),
    sticker_id: z
      .string({ error: 'Stiker tidak valid' })
      .trim()
      .min(1, 'Stiker tidak valid')
      .max(64, 'Stiker tidak valid')
      .nullish(),
  })
  .superRefine((val, ctx) => {
    const hasBody = (val.body?.trim().length ?? 0) > 0;
    const hasSticker = Boolean(val.sticker_id?.trim());
    const hasImage = Boolean(val.image?.url && val.image?.provider_file_id);
    if (hasSticker && hasImage) {
      ctx.addIssue({
        code: 'custom',
        path: ['sticker_id'],
        message: 'Stiker tidak bisa digabung dengan foto',
      });
    }
    if (!hasBody && !hasImage && !hasSticker) {
      ctx.addIssue({
        code: 'custom',
        path: ['body'],
        message: 'Komentar, foto, atau stiker wajib diisi',
      });
    }
  });

export type EntityCommentBody = z.infer<typeof entityCommentBodySchema>;