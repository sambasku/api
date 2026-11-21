import { z } from 'zod';

const weekIdPattern = /^\d{4}-W\d{2}$/;

export const getLeaderboardQuerySchema = z
  .object({
    period: z.enum(['week', 'all']).default('week'),
    week_id: z
      .string()
      .regex(weekIdPattern, 'Format week_id harus YYYY-Www, contoh 2026-W40')
      .optional(),
    metric: z.enum(['combined', 'contributions', 'verifications']).default('combined'),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .superRefine((val, ctx) => {
    if (val.period === 'week' && val.metric !== 'combined') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Metrik contributions atau verifications hanya untuk period=all',
        path: ['metric'],
      });
    }
  });

export const finalizeLeaderboardBodySchema = z.object({
  week_id: z
    .string()
    .regex(weekIdPattern, 'Format week_id harus YYYY-Www')
    .optional(),
});

export const leaderboardEntryWireSchema = z.object({
  rank: z.number().int(),
  username: z.string(),
  avatar_url: z.string().nullable(),
  contributions: z.number().int(),
  verifications: z.number().int(),
  combined: z.number().int(),
  is_verifier: z.boolean(),
});

export const leaderboardListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(leaderboardEntryWireSchema),
  meta: z.object({
    week_id: z.string().nullable(),
    resets_at: z.string().nullable(),
    metric: z.enum(['combined', 'contributions', 'verifications']),
    cdn: z.object({
      current: z.string().nullable(),
      weekly: z.string().nullable(),
    }),
  }),
});

export const leaderboardAdminActionResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    week_id: z.string().optional(),
    entry_count: z.number().int().optional(),
    refreshed: z.boolean().optional(),
    weekly_url: z.string().nullable().optional(),
    current_url: z.string().nullable().optional(),
  }),
});

const opaqueUserId = z.string().min(1).max(26);

export const leaderboardExclusionRowSchema = z.object({
  user_id: z.string(),
  username: z.string(),
  display_name: z.string().nullable(),
  note: z.string().nullable(),
  created_at: z.string(),
  is_default_system: z.boolean(),
});

export const leaderboardExclusionListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(leaderboardExclusionRowSchema),
});

export const addLeaderboardExclusionBodySchema = z.object({
  user_id: opaqueUserId,
  note: z.string().max(500).nullable().optional(),
});

export const leaderboardExclusionMutationResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    excluded: z.boolean(),
    refreshed: z.boolean(),
    current_url: z.string().nullable(),
    week_id: z.string().nullable(),
  }),
});

export type GetLeaderboardQuery = z.infer<typeof getLeaderboardQuerySchema>;
export type FinalizeLeaderboardBody = z.infer<typeof finalizeLeaderboardBodySchema>;
export type AddLeaderboardExclusionBody = z.infer<typeof addLeaderboardExclusionBodySchema>;