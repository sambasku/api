import { z } from 'zod';
import { opaqueId } from '@/shared/validation/id';

// PRD relasi-lemma: moderasi kelompok. published = melebar ke pencarian;
// pending_review/rejected tidak tampil publik.
const statusSchema = z.enum(['pending_review', 'published', 'rejected']);

export const createWordGroupBodySchema = z
  .object({
    name: z.string().min(1, 'Nama kelompok wajib diisi').max(120),
    description: z.string().max(500).nullable().optional(),
    status: statusSchema.optional(),
  })
  .strict();

export const updateWordGroupBodySchema = createWordGroupBodySchema.partial().strict();

export const addWordGroupMemberBodySchema = z
  .object({
    word_id: opaqueId,
    notes: z.string().max(300).nullable().optional(),
    status: statusSchema.optional(),
  })
  .strict();

export const listWordGroupsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  before: z.string().min(1).max(64).optional(),
  q: z.string().max(120).optional(),
  status: statusSchema.optional(),
  word_id: opaqueId.optional(),
});

export const wordGroupIdQuerySchema = z.object({
  id: z.string().min(1).max(64),
});

export const removeWordGroupMemberQuerySchema = z.object({
  id: z.string().min(1).max(64),
  word_id: opaqueId,
});

export const wordGroupMemberSchema = z.object({
  id: z.string(),
  word_id: z.string(),
  lemma: z.string(),
  notes: z.string().nullable(),
  status: statusSchema,
});

export const wordGroupDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: statusSchema,
  is_verified: z.boolean(),
  members: z.array(wordGroupMemberSchema),
});

export const wordGroupItemResponseSchema = z.object({
  success: z.literal(true),
  data: wordGroupDataSchema,
});

export const wordGroupListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(wordGroupDataSchema),
    next_cursor: z.string().nullable(),
  }),
});
