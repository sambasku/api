import { z } from 'zod';
import { BATCH_CONTRIBUTE_MAX_ROWS } from '@/modules/word/application/use-cases/batch-contribute-words.use-case';

const batchRowSchema = z.object({
  sambas: z.string().trim().min(1, 'Kata Sambas wajib diisi').max(255),
  indonesia: z.string().trim().min(1, 'Padanan Indonesia wajib diisi').max(500),
});

export const batchContributeWordsBodySchema = z.object({
  contributor_name: z.string().trim().max(80).optional(),
  rows: z
    .array(batchRowSchema)
    .min(1, 'Minimal satu baris kata harus diisi')
    .max(BATCH_CONTRIBUTE_MAX_ROWS, `Maksimal ${BATCH_CONTRIBUTE_MAX_ROWS} kata per kiriman`),
});

export const batchContributeWordsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    session_id: z.string(),
    total: z.number(),
    created_count: z.number(),
    duplicates_count: z.number(),
    meanings_added_count: z.number(),
    invalid_count: z.number(),
    items: z.array(
      z.object({
        lemma: z.string(),
        outcome: z.enum(['created', 'meanings_added', 'skipped', 'invalid']),
        status: z.enum(['draft', 'published']).optional(),
        is_verified: z.boolean().optional(),
        meanings_added: z.number(),
        meanings_skipped: z.number(),
        message: z.string().optional(),
        word_id: z.string().optional(),
      }),
    ),
  }),
});

export type BatchContributeWordsBody = z.infer<typeof batchContributeWordsBodySchema>;
