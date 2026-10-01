import { z } from 'zod';
import { opaqueId } from '@/shared/validation/id';

export const publicProfileParamsSchema = z.object({
  username: z.string().trim().min(1).max(100),
});

export const mentionSuggestQuerySchema = z.object({
  q: z.string().trim().min(2).max(30),
});

export const mentionSuggestItemSchema = z.object({
  id: opaqueId,
  username: z.string(),
  display_name: z.string(),
  avatar_url: z.string().url().nullable(),
});

export const mentionSuggestResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(mentionSuggestItemSchema),
  }),
});

export const publicProfileResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    username: z.string(),
    display_name: z.string(),
    bio: z.string().nullable(),
    role: z.string(),
    is_verifier: z.boolean(),
    joined_at: z.string(),
    avatar_url: z.string().url().nullable(),
    stats: z.object({
      contributions_approved: z.number().int(),
      verifications_done: z.number().int(),
      comments_published: z.number().int(),
    }),
  }),
});

export const publicActivityQuerySchema = z.object({
  kind: z.enum(['contribution', 'comment', 'verification', 'vote']).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: opaqueId.optional(),
});

export type PublicActivityQuery = z.infer<typeof publicActivityQuerySchema>;

export const publicActivityResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(
      z.object({
        id: z.string().length(26),
        kind: z.enum(['contribution', 'comment', 'verification', 'vote']),
        occurred_at: z.string(),
        word_id: z.string().nullable(),
        lemma: z.string().nullable(),
        summary: z.string(),
      }),
    ),
  }),
  meta: z
    .object({
      limit: z.number().int(),
      next_cursor: z.string().nullable(),
      has_more: z.boolean(),
    })
    .optional(),
});

export const avatarUploadResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    avatar_url: z.string().url(),
  }),
});
