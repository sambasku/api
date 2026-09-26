import { and, eq, gte, isNotNull, isNull, sql } from 'drizzle-orm';
import {
  auditLogs,
  bugReports,
  comments,
  contributions,
  users,
  votes,
  wordReports,
  words,
} from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type {
  ActivityDailyPoint,
  AppRoleKey,
  ContributionStatusKey,
  DashboardStats,
  ProblemSourceCounts,
  WordStatusKey,
} from '../domain/entities/dashboard-stats.entity';
import type { DashboardRepository } from '../domain/repositories/dashboard.repository';

type StatusRow = { status: string; count: number };
type DayCountRow = { day: string; count: number };

function toRecord<T extends string>(keys: readonly T[], rows: StatusRow[]): Record<T, number> {
  const record = Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
  for (const row of rows) {
    if (row.status in record) record[row.status as T] = row.count;
  }
  return record;
}

const WORD_STATUSES = ['draft', 'pending_review', 'published', 'rejected'] as const;
const CONTRIBUTION_STATUSES = ['pending', 'approved', 'rejected', 'corrected'] as const;
const APP_ROLES = ['root', 'admin', 'editor', 'reviewer', 'contributor'] as const;

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Jakarta, UTC+7 tanpa DST
const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_WINDOW_DAYS = 30;

/** 'YYYY-MM-DD' di zona WIB - sama dengan WOTD. */
export function wibDateString(now: Date): string {
  return new Date(now.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/** Geser tanggal kalender 'YYYY-MM-DD' (bukan wall-clock zona). */
export function shiftCalendarDate(ymd: string, deltaDays: number): string {
  const utc = new Date(`${ymd}T00:00:00.000Z`);
  utc.setUTCDate(utc.getUTCDate() + deltaDays);
  return utc.toISOString().slice(0, 10);
}

/** Awal hari WIB sebagai Instant UTC (untuk filter gte created_at). */
export function startOfWibDayUtc(ymd: string): Date {
  return new Date(`${ymd}T00:00:00+07:00`);
}

function toDayMap(rows: DayCountRow[]): Map<string, number> {
  return new Map(rows.map((row) => [row.day, row.count]));
}

/**
 * Selalu 30 titik inklusif (todayWib-29 … todayWib); series kosong = 0.
 * Panjang tetap supaya layout chart admin tidak bergeser.
 */
export function fillDailyActivityLast30Days(
  series: {
    contributions: DayCountRow[];
    votes: DayCountRow[];
    comments: DayCountRow[];
    newUsers: DayCountRow[];
  },
  todayWib: string,
): ActivityDailyPoint[] {
  const contributions = toDayMap(series.contributions);
  const votesMap = toDayMap(series.votes);
  const commentsMap = toDayMap(series.comments);
  const newUsers = toDayMap(series.newUsers);
  const points: ActivityDailyPoint[] = [];
  for (let i = DAILY_WINDOW_DAYS - 1; i >= 0; i -= 1) {
    const date = shiftCalendarDate(todayWib, -i);
    points.push({
      date,
      contributions: contributions.get(date) ?? 0,
      votes: votesMap.get(date) ?? 0,
      comments: commentsMap.get(date) ?? 0,
      newUsers: newUsers.get(date) ?? 0,
    });
  }
  return points;
}

/** Bug: open vs closed (resolved + rejected). */
export function mapBugProblemCounts(rows: StatusRow[]): ProblemSourceCounts {
  let open = 0;
  let closed = 0;
  for (const row of rows) {
    if (row.status === 'open') open += row.count;
    else if (row.status === 'resolved' || row.status === 'rejected') closed += row.count;
  }
  return { open, closed };
}

/** Word report: open vs resolved. */
export function mapWordProblemCounts(rows: StatusRow[]): ProblemSourceCounts {
  let open = 0;
  let closed = 0;
  for (const row of rows) {
    if (row.status === 'open') open += row.count;
    else if (row.status === 'resolved') closed += row.count;
  }
  return { open, closed };
}

// Agregasi ringan lintas tabel untuk halaman dashboard. Semua query jalan
// paralel (satu Promise.all) - dashboard tampil cepat tanpa beban kunci.
export class DashboardRepositoryImpl implements DashboardRepository {
  constructor(private readonly db: AppDatabase) {}

  async getStats(now: Date = new Date()): Promise<DashboardStats> {
    const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);
    const todayWib = wibDateString(now);
    const windowStartYmd = shiftCalendarDate(todayWib, -(DAILY_WINDOW_DAYS - 1));
    const windowStart = startOfWibDayUtc(windowStartYmd);

    // created_at disimpan detik unix (drizzle mode: 'timestamp') → unixepoch + WIB
    const contributionDayExpr = sql<string>`strftime('%Y-%m-%d', ${contributions.createdAt}, 'unixepoch', '+7 hours')`;
    const voteDayExpr = sql<string>`strftime('%Y-%m-%d', ${votes.createdAt}, 'unixepoch', '+7 hours')`;
    const commentDayExpr = sql<string>`strftime('%Y-%m-%d', ${comments.createdAt}, 'unixepoch', '+7 hours')`;
    const userDayExpr = sql<string>`strftime('%Y-%m-%d', ${users.createdAt}, 'unixepoch', '+7 hours')`;

    const [
      wordByStatus,
      wordVerified,
      wordDeleted,
      contributionByStatus,
      contributionDailyRows,
      voteDailyRows,
      commentDailyRows,
      newUserDailyRows,
      userByRole,
      auditLast7Days,
      bugByStatus,
      wordReportByStatus,
    ] = await Promise.all([
      this.db
        .select({ status: words.status, count: sql<number>`count(*)`.mapWith(Number) })
        .from(words)
        .where(isNull(words.deletedAt))
        .groupBy(words.status),

      this.db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(words)
        .where(and(isNull(words.deletedAt), eq(words.isVerified, true))),

      this.db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(words)
        .where(isNotNull(words.deletedAt)),

      this.db
        .select({ status: contributions.status, count: sql<number>`count(*)`.mapWith(Number) })
        .from(contributions)
        .where(isNull(contributions.deletedAt))
        .groupBy(contributions.status),

      this.db
        .select({
          day: contributionDayExpr,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(contributions)
        .where(and(isNull(contributions.deletedAt), gte(contributions.createdAt, windowStart)))
        .groupBy(contributionDayExpr),

      this.db
        .select({
          day: voteDayExpr,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(votes)
        .where(gte(votes.createdAt, windowStart))
        .groupBy(voteDayExpr),

      this.db
        .select({
          day: commentDayExpr,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(comments)
        .where(and(isNull(comments.deletedAt), gte(comments.createdAt, windowStart)))
        .groupBy(commentDayExpr),

      this.db
        .select({
          day: userDayExpr,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(users)
        .where(and(isNull(users.deletedAt), gte(users.createdAt, windowStart)))
        .groupBy(userDayExpr),

      this.db
        .select({ status: users.role, count: sql<number>`count(*)`.mapWith(Number) })
        .from(users)
        .where(and(isNull(users.deletedAt), eq(users.isActive, true)))
        .groupBy(users.role),

      this.db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(auditLogs)
        .where(gte(auditLogs.createdAt, sevenDaysAgo)),

      this.db
        .select({ status: bugReports.status, count: sql<number>`count(*)`.mapWith(Number) })
        .from(bugReports)
        .where(isNull(bugReports.deletedAt))
        .groupBy(bugReports.status),

      this.db
        .select({ status: wordReports.status, count: sql<number>`count(*)`.mapWith(Number) })
        .from(wordReports)
        .groupBy(wordReports.status),
    ]);

    const wordCounts = toRecord(WORD_STATUSES, wordByStatus);
    const contributionCounts = toRecord(CONTRIBUTION_STATUSES, contributionByStatus);
    const roleCounts = toRecord(APP_ROLES, userByRole);
    const bugCounts = mapBugProblemCounts(bugByStatus);
    const wordReportCounts = mapWordProblemCounts(wordReportByStatus);

    return {
      words: {
        total: totalOf(wordCounts),
        verified: countOf(wordVerified),
        deleted: countOf(wordDeleted),
        byStatus: wordCounts as Record<WordStatusKey, number>,
      },
      contributions: {
        total: totalOf(contributionCounts),
        byStatus: contributionCounts as Record<ContributionStatusKey, number>,
      },
      users: {
        active: totalOf(roleCounts),
        byRole: roleCounts as Record<AppRoleKey, number>,
      },
      activity: {
        auditLogsLast7Days: countOf(auditLast7Days),
        dailyLast30Days: fillDailyActivityLast30Days(
          {
            contributions: contributionDailyRows,
            votes: voteDailyRows,
            comments: commentDailyRows,
            newUsers: newUserDailyRows,
          },
          todayWib,
        ),
      },
      problems: {
        open: bugCounts.open + wordReportCounts.open,
        closed: bugCounts.closed + wordReportCounts.closed,
        bySource: {
          bugReports: bugCounts,
          wordReports: wordReportCounts,
        },
      },
    };
  }
}

function totalOf(record: Record<string, number>): number {
  return Object.values(record).reduce((acc, value) => acc + value, 0);
}

function countOf(rows: { count: number }[]): number {
  const [row] = rows;
  return row?.count ?? 0;
}
