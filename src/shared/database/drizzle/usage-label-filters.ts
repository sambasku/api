import { and, sql, type SQL } from 'drizzle-orm';
import { words } from '@/shared/database/drizzle/schema';
import {
  BROWSE_EXCLUDED_USAGE_LABELS,
  FEED_EXCLUDED_USAGE_LABELS,
} from '@/shared/constants/usage-labels';

type UsageLabelsColumn = typeof words.usageLabels;

/** Klausa `NOT LIKE` per label feed-excluded (bisa di-`and` / `sql.join`). */
export function feedExcludedUsageLabelClauses(
  column: UsageLabelsColumn = words.usageLabels,
): SQL[] {
  return FEED_EXCLUDED_USAGE_LABELS.map(
    (label) => sql`${column} NOT LIKE ${`%"${label}"%`}`,
  );
}

/** Klausa `NOT LIKE` per label browse-excluded (A-Z tanpa `q`). */
export function browseExcludedUsageLabelClauses(
  column: UsageLabelsColumn = words.usageLabels,
): SQL[] {
  return BROWSE_EXCLUDED_USAGE_LABELS.map(
    (label) => sql`${column} NOT LIKE ${`%"${label}"%`}`,
  );
}

/** SQL: sembunyikan kata dengan label feed-excluded. */
export function feedSafeUsageLabelsSql(
  column: UsageLabelsColumn = words.usageLabels,
): SQL | undefined {
  return and(...feedExcludedUsageLabelClauses(column));
}

/** SQL: sembunyikan kasar/diskriminatif dari browsing A-Z tanpa `q`. */
export function browseSafeUsageLabelsSql(
  column: UsageLabelsColumn = words.usageLabels,
): SQL | undefined {
  return and(...browseExcludedUsageLabelClauses(column));
}
