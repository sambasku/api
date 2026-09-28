import { z } from 'zod';
import { choiceId } from '@/shared/validation/id';

const importMeaningSchema = z
  .object({
    translation: z.string().trim().max(500).optional(),
    definition: z.string().trim().max(2000).optional(),
    example: z.string().trim().max(500).optional(),
  })
  .refine((m) => !!m.translation || !!m.definition, {
    message: 'Terjemahan atau definisi wajib terisi',
  });

export const importWordsBodySchema = z.object({
  mode: z.enum(['validate', 'commit']),
  /** Opsional: atribusi ke user nyata; kosong = Pengimpor Data CSV. */
  attributed_to: choiceId('User atribusi').optional(),
  items: z
    .array(
      z.object({
        lemma: z.string().trim().min(1, 'Kata tidak boleh kosong').max(255),
        verify: z.boolean().default(false),
        verified: z.boolean().default(false),
        notes: z.string().trim().max(2000).optional(),
        meanings: z.array(importMeaningSchema).min(1).max(20),
      }),
    )
    .min(1)
    .max(5),
});

export const importWordsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(
      z.object({
        lemma: z.string(),
        outcome: z.enum(['created', 'meanings_added', 'skipped', 'invalid']),
        status: z.enum(['draft', 'published']).optional(),
        is_verified: z.boolean().optional(),
        meanings_added: z.number(),
        meanings_skipped: z.number(),
        message: z.string().optional(),
      }),
    ),
  }),
});

export type ImportWordsBody = z.infer<typeof importWordsBodySchema>;
