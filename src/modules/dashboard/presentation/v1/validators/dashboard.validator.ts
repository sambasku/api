import { z } from 'zod';

const wordStatusSchema = z.enum(['draft', 'pending_review', 'published', 'rejected']);
const contributionStatusSchema = z.enum(['pending', 'approved', 'rejected', 'corrected']);
const appRoleSchema = z.enum(['root', 'admin', 'editor', 'reviewer', 'contributor']);

const activityDailyPointSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  contributions: z.number().int().nonnegative(),
  votes: z.number().int().nonnegative(),
  comments: z.number().int().nonnegative(),
  new_users: z.number().int().nonnegative(),
});

const problemSourceSchema = z.object({
  open: z.number().int().nonnegative(),
  closed: z.number().int().nonnegative(),
});

export const dashboardStatsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    words: z.object({
      total: z.number().int(),
      verified: z.number().int(),
      deleted: z.number().int(),
      by_status: z.record(wordStatusSchema, z.number().int()),
    }),
    contributions: z.object({
      total: z.number().int(),
      by_status: z.record(contributionStatusSchema, z.number().int()),
    }),
    users: z.object({
      active: z.number().int(),
      online_recently: z.number().int().nonnegative(),
      by_role: z.record(appRoleSchema, z.number().int()),
    }),
    activity: z.object({
      audit_logs_last_7_days: z.number().int(),
      daily_last_30_days: z.array(activityDailyPointSchema).length(30),
    }),
    problems: z.object({
      open: z.number().int().nonnegative(),
      closed: z.number().int().nonnegative(),
      by_source: z.object({
        bug_reports: problemSourceSchema,
        word_reports: problemSourceSchema,
      }),
    }),
    verifier_applications: z.object({
      pending: z.number().int().nonnegative(),
      approved: z.number().int().nonnegative(),
      rejected: z.number().int().nonnegative(),
    }),
  }),
});
