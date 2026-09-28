import { z } from 'zod';

export const listActivityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
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
  ]),
  created_at: z.string(),
  actor: activityActorSchema,
  body: z.string(),
  subtitle: z.string().nullable(),
  target: activityTargetSchema,
});

export const listActivityResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(activityItemSchema),
  meta: z.object({
    limit: z.number().int(),
  }),
});
