import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Counter pencarian per hari (hit + miss) - sumber series "Pencarian"
 * di chart dashboard. Satu baris per hari, upsert count+1.
 */
export const searchDaily = sqliteTable('search_daily', {
  day: text('day').primaryKey(), // 'YYYY-MM-DD' WIB
  count: integer('count').notNull().default(0),
});

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Jakarta, UTC+7 tanpa DST

/** 'YYYY-MM-DD' di zona WIB - basis baris counter harian. */
export function searchDayWib(now: Date): string {
  return new Date(now.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}
