import { z } from 'zod';

const opaqueId = z.string().min(1).max(64);

export const createUgcCommentLemmaLinkBodySchema = z.object({
  start: z.number().int().min(0),
  end: z.number().int().min(1),
  word_id: opaqueId,
});

export type CreateUgcCommentLemmaLinkBody = z.infer<
  typeof createUgcCommentLemmaLinkBodySchema
>;

export const ugcCommentLemmaLinkWireSchema = z.object({
  id: opaqueId,
  anchor_kind: z.string(),
  host_id: opaqueId,
  comment_id: opaqueId,
  start: z.number().int(),
  end: z.number().int(),
  word_id: opaqueId,
  lemma: z.string().nullable(),
  status: z.string(),
  source: z.string(),
  proposed_word_id: z.string().nullable(),
  proposed_lemma: z.string().nullable(),
  proposed_by: z.string().nullable(),
  created_at: z.string(),
});