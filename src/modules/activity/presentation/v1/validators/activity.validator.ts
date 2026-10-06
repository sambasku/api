import { z } from 'zod';

export const listActivityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).optional(),
  /**
   * true = buang baris milik user yang sedang login (feed beranda mobile).
   *
   * Hanya berlaku bila pemanggil terautentikasi. Tanpa Bearer, feed tetap
   * publik penuh - flag ini bukan gate.
   *
   * Bentuk union (bukan `z.coerce.boolean()`) mengikuti
   * `contribution.validator.ts`: `Boolean("false") === true` akan membaca
   * `?exclude_self=false` sebagai true.
   */
  exclude_self: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((v) => v === true || v === 'true' || v === '1'),
});

export type ListActivityQuery = z.infer<typeof listActivityQuerySchema>;

const activityActorSchema = z
  .object({
    username: z.string().nullable(),
    display_name: z.string().nullable(),
    avatar_url: z.string().nullable(),
  })
  .nullable();

const activityTargetSchema = z
  .object({
    type: z.string(),
    id: z.string(),
  })
  .nullable();

export const activityItemSchema = z.object({
  id: z.string(),
  kind: z.enum([
    'word',
    'comment',
    'vote',
    'discussion',
    'word_image',
    'word_audio',
    'pronunciation',
    'example',
    'search_miss',
    'welcome',
    'card_share',
    'suggestion',
    'contribution',
  ]),
  created_at: z.string(),
  actor: activityActorSchema,
  body: z.string(),
  subtitle: z.string().nullable(),
  target: activityTargetSchema,
});

export const recordCardShareResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ recorded: z.boolean() }),
});

export const listActivityResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(activityItemSchema),
  meta: z.object({
    limit: z.number().int(),
    next_cursor: z.string().nullable(),
    has_more: z.boolean(),
  }),
});
