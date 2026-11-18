import { z } from 'zod';
import { opaqueId } from '@/shared/validation/id';

export const chatMessageIdParamSchema = z.object({
  id: opaqueId,
});

export const listChatMessagesQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    before_created_at: z.string().datetime({ offset: true }).optional(),
    before_id: opaqueId.optional(),
    after_created_at: z.string().datetime({ offset: true }).optional(),
    after_id: opaqueId.optional(),
  })
  .superRefine((v, ctx) => {
    const hasBeforeAt = v.before_created_at != null;
    const hasBeforeId = v.before_id != null;
    const hasAfterAt = v.after_created_at != null;
    const hasAfterId = v.after_id != null;
    if (hasBeforeAt !== hasBeforeId) {
      ctx.addIssue({
        code: 'custom',
        path: ['before_id'],
        message: 'before_created_at dan before_id harus dipakai berpasangan',
      });
    }
    if (hasAfterAt !== hasAfterId) {
      ctx.addIssue({
        code: 'custom',
        path: ['after_id'],
        message: 'after_created_at dan after_id harus dipakai berpasangan',
      });
    }
    if (hasBeforeAt && hasAfterAt) {
      ctx.addIssue({
        code: 'custom',
        path: ['before_id'],
        message: 'Pakai before_* atau after_*, jangan keduanya',
      });
    }
  });

export const createChatMessageBodySchema = z
  .object({
    kind: z.enum(['text', 'sticker']).default('text'),
    body: z.string().max(240).nullable().optional(),
    sticker_id: z.string().trim().min(1).max(128).nullable().optional(),
    reply_to_id: opaqueId.nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === 'text') {
      const body = (v.body ?? '').trim();
      if (!body) {
        ctx.addIssue({
          code: 'custom',
          path: ['body'],
          message: 'Pesan teks tidak boleh kosong',
        });
      }
    }
    if (v.kind === 'sticker') {
      const sid = (v.sticker_id ?? '').trim();
      if (!sid) {
        ctx.addIssue({
          code: 'custom',
          path: ['sticker_id'],
          message: 'Stiker wajib dipilih',
        });
      }
    }
  });

export const editChatMessageBodySchema = z.object({
  body: z
    .string({ error: 'Pesan teks tidak boleh kosong' })
    .trim()
    .min(1, 'Pesan teks tidak boleh kosong')
    .max(240, 'Pesan maksimal 240 karakter'),
});

const isoOrNull = z.string().datetime({ offset: true }).nullable();

export const chatMessageWireSchema = z.object({
  id: z.string(),
  channel: z.string(),
  user_id: z.string(),
  username: z.string().nullable(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  kind: z.enum(['text', 'sticker', 'voice_note']),
  body: z.string().nullable(),
  sticker_id: z.string().nullable(),
  audio_url: z.string().nullable(),
  duration_ms: z.number().int().nullable(),
  reply_to_id: z.string().nullable(),
  reply_snippet: z.string().nullable(),
  reply_username: z.string().nullable(),
  edited_at: isoOrNull,
  deleted_at: isoOrNull,
  created_at: z.string().datetime({ offset: true }),
});

export const chatMessageResponseSchema = z.object({
  success: z.literal(true),
  data: chatMessageWireSchema,
});

export const chatMessageListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(chatMessageWireSchema),
    has_more: z.boolean(),
  }),
});

export const chatCapabilitiesResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    voice_room_enabled: z.boolean(),
  }),
});

export const chatRevisionItemSchema = z.object({
  id: z.string(),
  message_id: z.string(),
  editor_id: z.string(),
  body: z.string(),
  created_at: z.string().datetime({ offset: true }),
});

export const chatRevisionsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(chatRevisionItemSchema),
});
