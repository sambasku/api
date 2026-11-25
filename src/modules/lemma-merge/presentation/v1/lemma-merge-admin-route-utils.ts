import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
import { rejectLemmaMergeBodySchema } from './lemma-merge.validator';

export async function readOptionalReviewNote(
  c: Context<{ Variables: AppVariables }>,
): Promise<string | undefined> {
  const contentType = c.req.header('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return undefined;
  }
  const raw: unknown = await c.req.json().catch(() => ({}));
  const parsed = rejectLemmaMergeBodySchema.safeParse(raw);
  return parsed.success ? parsed.data.review_note : undefined;
}