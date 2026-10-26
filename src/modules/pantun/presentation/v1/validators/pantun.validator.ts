import { z } from 'zod';
import { opaqueId } from '@/shared/validation/id';

const lineSchema = z
  .string({ error: 'Baris pantun wajib diisi' })
  .trim()
  .min(1, 'Baris pantun wajib diisi')
  .max(120, 'Satu baris maksimal 120 karakter');

export const pantunLinesSchema = z
  .array(lineSchema, { error: 'Pantun harus terdiri dari 4 baris' })
  .length(4, 'Pantun harus terdiri dari 4 baris');

export const rhymeSchemeSchema = z.enum(['ABAB', 'AAAA'], {
  error: 'Pola rima tidak valid. Pakai ABAB atau AAAA.',
});

export const createPantunBodySchema = z.object({
  lines: pantunLinesSchema,
  /** Opsional: server deteksi sendiri ABAB/AAAA dari baris. */
  rhyme_scheme: rhymeSchemeSchema.optional(),
  /** Tema (row categories); opsional. */
  category_id: opaqueId.nullish(),
  /** Kode bahasa; default 'id'. */
  language: z
    .string({ error: 'Bahasa tidak valid' })
    .trim()
    .min(2, 'Bahasa tidak valid')
    .max(8, 'Bahasa tidak valid')
    .optional(),
});

export type CreatePantunBody = z.infer<typeof createPantunBodySchema>;

export const createPantunReplyBodySchema = z.object({
  lines: pantunLinesSchema,
  /** Opsional: server deteksi sendiri ABAB/AAAA dari baris. */
  rhyme_scheme: rhymeSchemeSchema.optional(),
  category_id: opaqueId.nullish(),
  language: z
    .string({ error: 'Bahasa tidak valid' })
    .trim()
    .min(2, 'Bahasa tidak valid')
    .max(8, 'Bahasa tidak valid')
    .optional(),
});

export type CreatePantunReplyBody = z.infer<typeof createPantunReplyBodySchema>;

export const pantunIdParamSchema = z.object({
  id: opaqueId,
});

export const pantunReplyIdParamSchema = z.object({
  id: opaqueId,
});

export const listPantunsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: opaqueId.optional(),
  category_id: opaqueId.optional(),
});

export type ListPantunsQuery = z.infer<typeof listPantunsQuerySchema>;

export const listAdminPantunsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: opaqueId.optional(),
});

export type ListAdminPantunsQuery = z.infer<typeof listAdminPantunsQuerySchema>;

const pantunLineItemSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  display_name: z.string().nullable(),
  username: z.string().nullable(),
  avatar_url: z.string().nullable(),
  parent_id: z.string().nullable(),
  language: z.string(),
  theme_id: z.string().nullable(),
  rhyme_scheme: rhymeSchemeSchema,
  lines: z.array(z.string()).length(4),
  status: z.enum(['published', 'taken_down', 'deleted_by_author']),
  created_at: z.string(),
  updated_at: z.string().nullable(),
});

export const pantunItemSchema = pantunLineItemSchema;

export const createPantunResponseSchema = z.object({
  success: z.literal(true),
  data: pantunItemSchema,
});

export const listPantunsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(pantunItemSchema),
  meta: z.object({
    limit: z.number(),
    next_cursor: z.string().nullable(),
    has_more: z.boolean(),
  }),
});

export const pantunDetailResponseSchema = z.object({
  success: z.literal(true),
  data: pantunItemSchema.extend({
    replies: z.array(pantunLineItemSchema),
  }),
});

export const deletePantunResponseSchema = z.object({
  success: z.literal(true),
  data: z.null(),
});
