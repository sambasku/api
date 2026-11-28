import { z } from 'zod';
import { opaqueId } from '@/shared/validation/id';

export const inboxNotificationTypeSchema = z.enum([
  'contribution_approved',
  'contribution_rejected',
  'contribution_corrected',
  'suggestion_approved',
  'suggestion_rejected',
  'suggestion_corrected',
  'word_taken_down',
  'contribution_paused',
  'contribution_resumed',
  'discussion_pending_review',
  'discussion_approved',
  'discussion_rejected',
  'discussion_taken_down',
  'discussion_reply',
  'discussion_mention',
  'pantun_reply',
  'pantun_mention',
  'jinye_comment',
  'chat_mention',
  'word_comment',
  'photo_comment',
  'photo_comment_reply',
  'word_vote',
  'article_clap',
  'meaning_auto_verified',
  'meaning_needs_review',
  'meaning_auto_rejected',
  'word_example',
  'word_audio',
  'campaign',
  'verifier_application_approved',
  'verifier_application_rejected',
  'streak_reminder',
  'level_up',
  'baleho_placement_approved',
  'baleho_placement_rejected',
  'baleho_placement_ending_soon',
]);

export const notificationTargetKindSchema = z.enum([
  'article',
  'contribution',
  'suggestion',
  'word',
  'discussion',
  'campaign',
  'verifier_application',
  'pantun',
  'jinye',
  'chat',
  'photo',
  'day',
  'level',
  'baleho_placement',
]);

export const notificationActionKindSchema = z.enum([
  'article',
  'word',
  'contribution',
  'suggestion',
  'discussion',
  'pantun',
  'jinye',
  'chat',
  'photo',
  'url',
  'baleho_placement',
]);

export const listNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: opaqueId.optional(),
  unread: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

export const notificationIdParamsSchema = z.object({
  id: opaqueId,
});

const notificationItemSchema = z.object({
  id: z.string(),
  type: inboxNotificationTypeSchema,
  title: z.string(),
  body: z.string(),
  body_type: z.enum(['plain', 'html', 'md', 'webview']),
  image_url: z.string().nullable(),
  target_kind: notificationTargetKindSchema,
  target_id: z.string(),
  action_kind: notificationActionKindSchema.nullable(),
  action_value: z.string().nullable(),
  read_at: z.string().nullable(),
  created_at: z.string(),
});

export const listNotificationsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(notificationItemSchema),
  meta: z.object({
    limit: z.number().int(),
    next_cursor: z.string().nullable(),
    has_more: z.boolean(),
  }),
});

export const unreadCountResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    unread_count: z.number().int(),
  }),
});

export const markReadResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string(),
    already_read: z.boolean(),
  }),
});

export const markAllReadResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    updated: z.number().int(),
  }),
});
