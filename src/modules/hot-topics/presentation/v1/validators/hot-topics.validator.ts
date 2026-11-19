import { z } from 'zod';

export const hotTopicsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).optional().default(10),
});

export type HotTopicsQueryBody = z.infer<typeof hotTopicsQuerySchema>;

const tabMetaSchema = z.object({
  in_window: z.number().int(),
  backfilled: z.number().int(),
  backfill_used: z.boolean(),
});

const searchedItemSchema = z.object({
  kind: z.literal('search_miss'),
  id: z.string(),
  term: z.string(),
  direction: z.enum(['lemma', 'translation']),
  hit_count: z.number().int(),
  last_searched_at: z.string(),
  in_window: z.boolean(),
});

const proposedItemSchema = z.object({
  kind: z.literal('contribution'),
  id: z.string(),
  word_id: z.string(),
  lemma: z.string(),
  created_at: z.string(),
  in_window: z.boolean(),
});

const viewedItemSchema = z.object({
  kind: z.literal('word_view'),
  word_id: z.string(),
  lemma: z.string(),
  view_count: z.number().int(),
  last_viewed_day: z.string(),
  in_window: z.boolean(),
});

export const hotTopicsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    searched: z.object({
      items: z.array(searchedItemSchema),
      meta: tabMetaSchema,
    }),
    proposed: z.object({
      items: z.array(proposedItemSchema),
      meta: tabMetaSchema,
    }),
    viewed: z.object({
      items: z.array(viewedItemSchema),
      meta: tabMetaSchema,
    }),
  }),
});
