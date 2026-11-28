import { z } from 'zod';
import { LAYANAN_CATEGORY_ICONS } from '../../../domain/entities/layanan-category.entity';

const statusSchema = z.enum(['published', 'archived']);
const idSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Id kategori hanya slug huruf kecil dan hyphen');
const shortLabelSchema = z.string().trim().min(1).max(20);

export const createLayananCategoryBodySchema = z
  .object({
    id: idSchema,
    name: z.string().trim().min(1).max(80),
    short_label: shortLabelSchema,
    icon: z.enum(LAYANAN_CATEGORY_ICONS).optional(),
    status: statusSchema.optional(),
    sort_order: z.number().int().min(0).max(9999).optional(),
  })
  .strict();

/** `id` (slug) tidak bisa diubah: dipakai sebagai nilai layanans.category. */
export const updateLayananCategoryBodySchema = createLayananCategoryBodySchema
  .partial()
  .omit({ id: true })
  .strict();

export const listLayananCategoriesQuerySchema = z.object({
  status: statusSchema.optional(),
});

export const layananCategoryIdQuerySchema = z.object({
  id: idSchema,
});

export const layananCategoryItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  short_label: z.string(),
  icon: z.string(),
  status: statusSchema,
  sort_order: z.number(),
  created_at: z.number(),
  updated_at: z.number().nullable(),
});

export const layananCategoryItemResponseSchema = z.object({
  success: z.literal(true),
  data: layananCategoryItemSchema,
});

export const layananCategoryListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(layananCategoryItemSchema),
  }),
});
