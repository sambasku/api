import { z } from 'zod';

const statusSchema = z.enum(['draft', 'published', 'archived']);
const idSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Id kategori hanya slug huruf kecil dan hyphen');

export const createCulinaryCategoryBodySchema = z
  .object({
    id: idSchema,
    name: z.string().min(1).max(80),
    status: statusSchema.optional(),
    sort_order: z.number().int().min(0).max(9999).optional(),
  })
  .strict();

export const updateCulinaryCategoryBodySchema = createCulinaryCategoryBodySchema
  .partial()
  .omit({ id: true })
  .strict();

export const listCulinaryCategoriesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  before: z.string().min(1).max(64).optional(),
  q: z.string().max(80).optional(),
  status: statusSchema.optional(),
});

export const culinaryCategoryIdQuerySchema = z.object({
  id: idSchema,
});

export const culinaryCategoryItemResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string(),
    name: z.string(),
    status: statusSchema,
    sort_order: z.number(),
    created_at: z.number(),
    updated_at: z.number().nullable(),
  }),
});

export const culinaryCategoryListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(culinaryCategoryItemResponseSchema.shape.data),
    next_cursor: z.string().nullable(),
  }),
});
