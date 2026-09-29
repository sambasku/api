import { z } from 'zod';
import { choiceId, opaqueId } from '@/shared/validation/id';

const importSessionItemSchema = z.object({
  lemma: z.string().trim().min(1).max(255),
  outcome: z.enum(['created', 'meanings_added', 'skipped', 'invalid']),
  meanings_added: z.number().int().min(0),
  message: z.string().trim().max(2000).optional(),
  word_id: opaqueId.optional(),
});

const supportTypeSchema = z.enum(['web', 'book', 'article', 'other']);

export const saveImportSessionBodySchema = z.object({
  id: opaqueId,
  source_label: z.string().trim().max(500).nullable().optional(),
  attributed_to: choiceId('User atribusi').optional(),
  support_name: z.string().trim().max(255).nullable().optional(),
  support_type: supportTypeSchema.nullable().optional(),
  support_address: z.string().trim().max(2000).nullable().optional(),
  support_title: z.string().trim().max(500).nullable().optional(),
  support_desc: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(['running', 'completed', 'cancelled', 'failed']),
  total: z.number().int().min(0),
  created_count: z.number().int().min(0),
  duplicates_count: z.number().int().min(0),
  meanings_added_count: z.number().int().min(0),
  invalid_count: z.number().int().min(0),
  items: z.array(importSessionItemSchema).max(5000),
});

export const claimImportSessionBodySchema = z.object({
  attributed_to: choiceId('User atribusi'),
});

export const listImportSessionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: opaqueId.optional(),
  q: z.string().trim().max(100).optional(),
});

export const importSessionResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string(),
    triggered_by: z.string(),
    triggered_by_username: z.string().nullable(),
    triggered_by_display_name: z.string().nullable(),
    attributed_to: z.string(),
    attributed_to_username: z.string().nullable(),
    attributed_to_display_name: z.string().nullable(),
    source_label: z.string().nullable(),
    support_name: z.string().nullable(),
    support_type: supportTypeSchema.nullable(),
    support_address: z.string().nullable(),
    support_title: z.string().nullable(),
    support_desc: z.string().nullable(),
    claimed_by: z.string().nullable(),
    claimed_by_username: z.string().nullable(),
    claimed_by_display_name: z.string().nullable(),
    claimed_at: z.string().nullable(),
    can_claim: z.boolean(),
    status: z.enum(['running', 'completed', 'cancelled', 'failed']),
    total: z.number(),
    created_count: z.number(),
    duplicates_count: z.number(),
    meanings_added_count: z.number(),
    invalid_count: z.number(),
    items: z.array(importSessionItemSchema),
    created_at: z.string(),
    finished_at: z.string().nullable(),
    rolled_back_at: z.string().nullable(),
    rolled_back_by: z.string().nullable(),
  }),
});

export const rollbackImportSessionResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    session_id: z.string(),
    deleted_count: z.number().int().min(0),
    session: importSessionResponseSchema.shape.data,
  }),
});

export type SaveImportSessionBody = z.infer<typeof saveImportSessionBodySchema>;
export type ClaimImportSessionBody = z.infer<typeof claimImportSessionBodySchema>;
export type ListImportSessionsQuery = z.infer<typeof listImportSessionsQuerySchema>;
