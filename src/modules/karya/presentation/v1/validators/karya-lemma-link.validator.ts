import { z } from 'zod';
import { opaqueId } from '@/shared/validation/id';

export const excerptIdParamSchema = z.object({
  excerptId: opaqueId,
});

export const karyaLemmaLinkExcerptParamSchema = z.object({
  excerptId: opaqueId,
  linkId: opaqueId,
});

export const karyaLemmaLinkIdParamSchema = z.object({
  id: opaqueId,
});

export const createKaryaLemmaLinkBodySchema = z.object({
  start: z.number().int().min(0),
  end: z.number().int().min(1),
  word_id: opaqueId,
});

export const proposeKaryaLemmaCorrectionBodySchema = z.object({
  word_id: opaqueId,
});

export const resolveKaryaLemmaCorrectionBodySchema = z.object({
  action: z.enum(['approve', 'reject']),
});

export const karyaLemmaLinkWireSchema = z.object({
  id: z.string(),
  excerpt_id: z.string(),
  start: z.number(),
  end: z.number(),
  word_id: z.string(),
  lemma: z.string().nullable(),
  status: z.string(),
  source: z.string(),
  proposed_word_id: z.string().nullable(),
  proposed_lemma: z.string().nullable(),
  proposed_by: z.string().nullable(),
  created_at: z.string(),
});