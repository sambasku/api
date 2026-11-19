import { eq } from 'drizzle-orm';
import { db } from '@/shared/database/drizzle/client';
import { appSettings } from '@/shared/database/drizzle/schema';
import {
  DEFAULT_SEARCH_MISS_AUTO_VISIBLE_ENABLED,
  SEARCH_MISS_AUTO_VISIBLE_ENABLED_KEY,
} from '@/modules/legal/domain/entities/app-setting.entity';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import { normalizeSearchMissTerm } from '../domain/normalize-term';
import {
  passesSearchMissQualityGate,
  searchMissBlocklistTokens,
} from '../domain/quality-gate';

/**
 * G3: apakah miss baru boleh auto-tayang.
 * Kill switch off / gagal quality / kena blocklist → false.
 */
export async function resolveSearchMissPreferVisible(input: {
  term: string;
  blocklist?: Pick<CommentBlocklistRepository, 'findActiveWordSet'>;
}): Promise<boolean> {
  if (!(await isSearchMissAutoVisibleEnabled())) return false;

  const normalized = normalizeSearchMissTerm(input.term);
  if (!passesSearchMissQualityGate(normalized)) return false;

  if (input.blocklist) {
    const tokens = searchMissBlocklistTokens(normalized);
    const blocked = await input.blocklist.findActiveWordSet(tokens);
    if (tokens.some((t) => blocked.has(t))) return false;
  }

  return true;
}

async function isSearchMissAutoVisibleEnabled(): Promise<boolean> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, SEARCH_MISS_AUTO_VISIBLE_ENABLED_KEY))
    .limit(1);
  if (!row) return DEFAULT_SEARCH_MISS_AUTO_VISIBLE_ENABLED;
  return row.value === 'true';
}

/** Test hook. */
export const __test = { isSearchMissAutoVisibleEnabled };
