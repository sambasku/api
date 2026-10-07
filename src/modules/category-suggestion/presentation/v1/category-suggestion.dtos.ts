import { z } from 'zod';

export const ProposeCategorySuggestionSchema = z.object({
  name: z.string().trim().min(2).max(60),
  reason: z.string().trim().max(200).optional(),
  contributor_name: z.string().trim().max(40).optional(),
});

export type ProposeCategorySuggestionDTO = z.infer<typeof ProposeCategorySuggestionSchema>;

export const ReviewCategorySuggestionSchema = z
  .object({
    action: z.enum(['approve', 'reject']),
    reject_reason: z.string().trim().min(2).max(200).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.action === 'reject' && !v.reject_reason) {
      ctx.addIssue({
        code: 'custom',
        path: ['reject_reason'],
        message: 'reject_reason wajib diisi saat action=reject',
      });
    }
  });

export type ReviewCategorySuggestionDTO = z.infer<typeof ReviewCategorySuggestionSchema>;

export const ListCategorySuggestionsQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type ListCategorySuggestionsQueryDTO = z.infer<typeof ListCategorySuggestionsQuerySchema>;

// Alias gaya controller (api#50).
export type ProposeCategorySuggestionBody = ProposeCategorySuggestionDTO;
export type ReviewCategorySuggestionBody = ReviewCategorySuggestionDTO;
export type ListCategorySuggestionsQuery = ListCategorySuggestionsQueryDTO;
