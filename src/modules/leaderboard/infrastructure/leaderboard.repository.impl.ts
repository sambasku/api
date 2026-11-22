import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, ne, notInArray, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import {
  contributionReviews,
  contributions,
  leaderboardExcludedUsers,
  leaderboardWeekEntries,
  leaderboardWeeks,
  userRoles,
  users,
  userWeekStats,
  wordEditSuggestions,
} from '@/shared/database/drizzle/schema';
import { isNoSuchTableError } from '@/shared/database/drizzle/sqlite-errors';
import { SYSTEM_USER_IDS, isSystemUserId } from '@/shared/constants/system-users';
import { isVerifierRole } from '@/modules/word/application/utils/resolve-publication';
import {
  LEADERBOARD_APPROVE_POINTS,
  LEADERBOARD_CREATE_SUBMIT_POINTS,
  LEADERBOARD_EDIT_SUBMIT_POINTS,
  LEADERBOARD_VERIFICATION_POINTS,
  TOP_N,
} from '../domain/utils/iso-week';
import type { LeaderboardEntry, LeaderboardWeekRecord } from '../domain/entities/leaderboard-entry.entity';
import type {
  LeaderboardExclusionRow,
  LeaderboardMetric,
  LeaderboardRepository,
  UpsertLeaderboardWeekInput,
} from '../domain/repositories/leaderboard.repository';

function buildActiveUserFilter(excludedUserIds: string[]): SQL | undefined {
  const parts: SQL[] = [eq(users.isActive, true), isNull(users.deletedAt)];
  if (excludedUserIds.length > 0) {
    parts.push(notInArray(users.id, excludedUserIds));
  }
  return and(...parts);
}

type MetricKey = 'combined' | 'submittedPoints' | 'approvedPoints' | 'verificationPoints';

const METRIC_KEYS: Record<LeaderboardMetric, MetricKey> = {
  combined: 'combined',
  submitted: 'submittedPoints',
  approved: 'approvedPoints',
  verifications: 'verificationPoints',
};

function assignCompetitionRanks(entries: LeaderboardEntry[]): void {
  let pos = 0;
  for (const e of entries) {
    pos += 1;
    e.rank = pos;
  }
}

function sortByMetric(entries: LeaderboardEntry[], metric: LeaderboardMetric): LeaderboardEntry[] {
  const key = METRIC_KEYS[metric];
  const sorted = [...entries].sort((a, b) => {
    const diff = b[key] - a[key];
    if (diff !== 0) return diff;
    return a.username.localeCompare(b.username);
  });
  assignCompetitionRanks(sorted);
  return sorted;
}

export class LeaderboardRepositoryImpl implements LeaderboardRepository {
  constructor(private readonly db: AppDatabase) {}

  async listExcludedUserIds(): Promise<string[]> {
    try {
      const rows = await this.db
        .select({ userId: leaderboardExcludedUsers.userId })
        .from(leaderboardExcludedUsers);
      if (rows.length === 0) {
        return [...SYSTEM_USER_IDS];
      }
      return rows.map((r) => r.userId);
    } catch (err) {
      if (isNoSuchTableError(err, 'leaderboard_excluded_users')) {
        return [...SYSTEM_USER_IDS];
      }
      throw err;
    }
  }

  async listExcludedUsers(): Promise<LeaderboardExclusionRow[]> {
    const rows = await this.db
      .select({
        userId: leaderboardExcludedUsers.userId,
        note: leaderboardExcludedUsers.note,
        createdAt: leaderboardExcludedUsers.createdAt,
        username: users.username,
        displayName: users.displayName,
      })
      .from(leaderboardExcludedUsers)
      .innerJoin(users, eq(users.id, leaderboardExcludedUsers.userId))
      .orderBy(asc(users.username));
    return rows.map((r) => ({
      userId: r.userId,
      username: r.username,
      displayName: r.displayName ?? null,
      note: r.note ?? null,
      createdAt: r.createdAt,
      isDefaultSystem: isSystemUserId(r.userId),
    }));
  }

  async listSystemUsers(): Promise<LeaderboardExclusionRow[]> {
    const rows = await this.db
      .select({
        userId: users.id,
        username: users.username,
        displayName: users.displayName,
        note: leaderboardExcludedUsers.note,
        createdAt: leaderboardExcludedUsers.createdAt,
      })
      .from(users)
      .leftJoin(
        leaderboardExcludedUsers,
        eq(leaderboardExcludedUsers.userId, users.id),
      )
      .where(inArray(users.id, [...SYSTEM_USER_IDS]))
      .orderBy(asc(users.username));
    return rows.map((r) => ({
      userId: r.userId,
      username: r.username,
      displayName: r.displayName ?? null,
      note: r.note ?? null,
      createdAt: r.createdAt ?? new Date(0),
      isDefaultSystem: true,
    }));
  }

  async addExclusion(userId: string, note?: string | null): Promise<void> {
    await this.db
      .insert(leaderboardExcludedUsers)
      .values({ userId, note: note ?? null })
      .onConflictDoNothing();
  }

  async removeExclusion(userId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(leaderboardExcludedUsers)
      .where(eq(leaderboardExcludedUsers.userId, userId))
      .returning({ userId: leaderboardExcludedUsers.userId });
    return deleted.length > 0;
  }

  async findUserForExclusion(userId: string): Promise<{ id: string } | null> {
    const [row] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async saveUserWeekStats(
    rows: Array<{
      userId: string;
      weekId: string;
      submittedPoints: number;
      approvedPoints: number;
      verificationPoints: number;
      combined: number;
      xpAtWeekEnd: number;
    }>,
  ): Promise<void> {
    if (rows.length === 0) return;
    await this.db
      .insert(userWeekStats)
      .values(rows)
      .onConflictDoUpdate({
        target: [userWeekStats.userId, userWeekStats.weekId],
        set: {
          submittedPoints: sql`excluded.submitted_points`,
          approvedPoints: sql`excluded.approved_points`,
          verificationPoints: sql`excluded.verification_points`,
          combined: sql`excluded.combined`,
          xpAtWeekEnd: sql`excluded.xp_at_week_end`,
        },
      });
  }

  async listUserWeekStats(
    userId: string,
    limit: number,
  ): Promise<
    Array<{
      weekId: string;
      submittedPoints: number;
      approvedPoints: number;
      verificationPoints: number;
      combined: number;
      xpAtWeekEnd: number;
    }>
  > {
    const rows = await this.db
      .select({
        weekId: userWeekStats.weekId,
        submittedPoints: userWeekStats.submittedPoints,
        approvedPoints: userWeekStats.approvedPoints,
        verificationPoints: userWeekStats.verificationPoints,
        combined: userWeekStats.combined,
        xpAtWeekEnd: userWeekStats.xpAtWeekEnd,
      })
      .from(userWeekStats)
      .where(eq(userWeekStats.userId, userId))
      .orderBy(desc(userWeekStats.weekId))
      .limit(limit);
    return rows;
  }

  private async loadVerifierFlags(userIds: string[]): Promise<Map<string, boolean>> {
    const map = new Map<string, boolean>();
    if (userIds.length === 0) return map;
    const rows = await this.db
      .select({ userId: userRoles.userId, role: userRoles.role })
      .from(userRoles)
      .where(inArray(userRoles.userId, userIds));
    const rolesByUser = new Map<string, string[]>();
    for (const row of rows) {
      const list = rolesByUser.get(row.userId) ?? [];
      list.push(row.role);
      rolesByUser.set(row.userId, list);
    }
    for (const id of userIds) {
      const roles = rolesByUser.get(id) ?? [];
      map.set(id, isVerifierRole(roles.length > 0 ? roles : ''));
    }
    return map;
  }

  /**
   * Poin skor per user (plan peringkat mingguan):
   * - submitted: usulan create x5 (bukan rejected) + usulan edit x3 (bukan rejected)
   * - approved: bonus keputusan approve/corrected x2 ke pengusul (dedup per baris sumber)
   * - verification: keputusan review non-self x2 ke reviewer (dedup per kontribusi)
   */
  private async aggregateScores(
    startedAt: Date | null,
    endedAt: Date | null,
    excludedUserIds: string[],
  ): Promise<
    Map<
      string,
      {
        userId: string;
        username: string;
        displayName: string | null;
        avatarUrl: string | null;
        submittedPoints: number;
        approvedPoints: number;
        verificationPoints: number;
      }
    >
  > {
    const byUser = new Map<
      string,
      {
        userId: string;
        username: string;
        displayName: string | null;
        avatarUrl: string | null;
        submittedPoints: number;
        approvedPoints: number;
        verificationPoints: number;
      }
    >();

    const touch = (
      userId: string,
      username: string,
      displayName: string | null,
      avatarUrl: string | null,
    ): {
      userId: string;
      username: string;
      displayName: string | null;
      avatarUrl: string | null;
      submittedPoints: number;
      approvedPoints: number;
      verificationPoints: number;
    } => {
      const existing = byUser.get(userId);
      if (existing) {
        if (!existing.avatarUrl && avatarUrl) existing.avatarUrl = avatarUrl;
        if (existing.displayName == null && displayName != null) existing.displayName = displayName;
        return existing;
      }
      const fresh = {
        userId,
        username,
        displayName: displayName ?? null,
        avatarUrl: avatarUrl ?? null,
        submittedPoints: 0,
        approvedPoints: 0,
        verificationPoints: 0,
      };
      byUser.set(userId, fresh);
      return fresh;
    };

    const windowContribution = startedAt && endedAt
      ? and(
          gte(contributions.createdAt, startedAt),
          lt(contributions.createdAt, endedAt),
        )
      : undefined;
    const windowSuggestion = startedAt && endedAt
      ? and(
          gte(wordEditSuggestions.createdAt, startedAt),
          lt(wordEditSuggestions.createdAt, endedAt),
        )
      : undefined;
    const windowReview = startedAt && endedAt
      ? and(
          gte(contributionReviews.createdAt, startedAt),
          lt(contributionReviews.createdAt, endedAt),
        )
      : undefined;
    const windowReviewedAt = startedAt && endedAt
      ? and(
          gte(wordEditSuggestions.reviewedAt, startedAt),
          lt(wordEditSuggestions.reviewedAt, endedAt),
        )
      : undefined;

    // 1) Poin usul create (x5): semua status kecuali rejected.
    const submittedRows = await this.db
      .select({
        userId: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(contributions)
      .innerJoin(users, eq(users.id, contributions.userId))
      .where(
        and(
          ne(contributions.status, 'rejected'),
          isNull(contributions.deletedAt),
          windowContribution,
          buildActiveUserFilter(excludedUserIds),
        ),
      )
      .groupBy(users.id, users.username, users.avatarUrl);
    for (const row of submittedRows) {
      touch(row.userId, row.username, row.displayName, row.avatarUrl).submittedPoints =
        row.count * LEADERBOARD_CREATE_SUBMIT_POINTS;
    }

    // 2) Poin usul edit (x3): semua status kecuali rejected.
    const editRows = await this.db
      .select({
        userId: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(wordEditSuggestions)
      .innerJoin(users, eq(users.id, wordEditSuggestions.userId))
      .where(
        and(
          ne(wordEditSuggestions.status, 'rejected'),
          isNull(wordEditSuggestions.deletedAt),
          windowSuggestion,
          buildActiveUserFilter(excludedUserIds),
        ),
      )
      .groupBy(users.id, users.username, users.avatarUrl);
    for (const row of editRows) {
      const entry = touch(row.userId, row.username, row.displayName, row.avatarUrl);
      entry.submittedPoints += row.count * LEADERBOARD_EDIT_SUBMIT_POINTS;
    }

    // 3) Bonus approve (x2) ke pengusul: create via join review, dedup per kontribusi.
    const approvedRows = await this.db
      .select({
        userId: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        count: sql<number>`count(distinct ${contributions.id})`.mapWith(Number),
      })
      .from(contributions)
      .innerJoin(users, eq(users.id, contributions.userId))
      .leftJoin(
        contributionReviews,
        and(
          eq(contributionReviews.contributionId, contributions.id),
          inArray(contributionReviews.status, ['approved', 'corrected']),
          isNull(contributionReviews.deletedAt),
          windowReview,
        ),
      )
      .where(
        and(
          inArray(contributions.status, ['approved', 'corrected']),
          isNull(contributions.deletedAt),
          buildActiveUserFilter(excludedUserIds),
        ),
      )
      .groupBy(users.id, users.username, users.avatarUrl)
      .having(sql`count(distinct ${contributionReviews.id}) > 0`);
    for (const row of approvedRows) {
      const entry = touch(row.userId, row.username, row.displayName, row.avatarUrl);
      entry.approvedPoints += row.count * LEADERBOARD_APPROVE_POINTS;
    }

    // 4) Bonus approve edit (x2) ke pengusul: wordEditSuggestions reviewed.
    const approvedEditRows = await this.db
      .select({
        userId: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(wordEditSuggestions)
      .innerJoin(users, eq(users.id, wordEditSuggestions.userId))
      .where(
        and(
          inArray(wordEditSuggestions.status, ['approved', 'corrected']),
          isNull(wordEditSuggestions.deletedAt),
          windowReviewedAt,
          buildActiveUserFilter(excludedUserIds),
        ),
      )
      .groupBy(users.id, users.username, users.avatarUrl);
    for (const row of approvedEditRows) {
      const entry = touch(row.userId, row.username, row.displayName, row.avatarUrl);
      entry.approvedPoints += row.count * LEADERBOARD_APPROVE_POINTS;
    }

    // 5) Poin verifikasi (x2) ke reviewer: keputusan non-self, dedup per kontribusi.
    const verificationRows = await this.db
      .select({
        userId: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        count: sql<number>`count(distinct ${contributionReviews.contributionId})`.mapWith(Number),
      })
      .from(contributionReviews)
      .innerJoin(contributions, eq(contributions.id, contributionReviews.contributionId))
      .innerJoin(users, eq(users.id, contributionReviews.reviewerId))
      .where(
        and(
          ne(contributionReviews.status, 'pending'),
          isNull(contributionReviews.deletedAt),
          isNotNull(contributionReviews.reviewerId),
          ne(contributionReviews.reviewerId, contributions.userId),
          windowReview,
          buildActiveUserFilter(excludedUserIds),
        ),
      )
      .groupBy(users.id, users.username, users.avatarUrl);
    for (const row of verificationRows) {
      const entry = touch(row.userId, row.username, row.displayName, row.avatarUrl);
      entry.verificationPoints = row.count * LEADERBOARD_VERIFICATION_POINTS;
    }

    return byUser;
  }

  private toEntries(
    byUser: Map<
      string,
      {
        userId: string;
        username: string;
        displayName: string | null;
        avatarUrl: string | null;
        submittedPoints: number;
        approvedPoints: number;
        verificationPoints: number;
      }
    >,
    metric: LeaderboardMetric,
    limit: number,
    verifierFlags: Map<string, boolean>,
  ): LeaderboardEntry[] {
    const draft: LeaderboardEntry[] = [];
    for (const row of byUser.values()) {
      const combined =
        row.submittedPoints + row.approvedPoints + row.verificationPoints;
      if (combined <= 0 && metric === 'combined') continue;
      if (metric === 'submitted' && row.submittedPoints <= 0) continue;
      if (metric === 'approved' && row.approvedPoints <= 0) continue;
      if (metric === 'verifications' && row.verificationPoints <= 0) continue;
      draft.push({
        rank: 0,
        userId: row.userId,
        username: row.username,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        submittedPoints: row.submittedPoints,
        approvedPoints: row.approvedPoints,
        verificationPoints: row.verificationPoints,
        combined,
        isVerifier: verifierFlags.get(row.userId) ?? false,
      });
    }
    const sorted = sortByMetric(draft, metric);
    return sorted.slice(0, limit);
  }

  async computeScoresForWindow(startedAt: Date, endedAt: Date): Promise<LeaderboardEntry[]> {
    const excludedUserIds = await this.listExcludedUserIds();
    const byUser = await this.aggregateScores(startedAt, endedAt, excludedUserIds);
    const sortedDraft = sortByMetric(
      [...byUser.values()].map((row) => ({
        rank: 0,
        userId: row.userId,
        username: row.username,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        submittedPoints: row.submittedPoints,
        approvedPoints: row.approvedPoints,
        verificationPoints: row.verificationPoints,
        combined: row.submittedPoints + row.approvedPoints + row.verificationPoints,
        isVerifier: false,
      })),
      'combined',
    ).filter((e) => e.combined > 0);
    const top = sortedDraft.slice(0, TOP_N);
    const flags = await this.loadVerifierFlags(top.map((e) => e.userId));
    for (const e of top) {
      e.isVerifier = flags.get(e.userId) ?? false;
    }
    return top;
  }

  async computeAllTime(metric: LeaderboardMetric, limit: number): Promise<LeaderboardEntry[]> {
    const excludedUserIds = await this.listExcludedUserIds();
    const byUser = await this.aggregateScores(null, null, excludedUserIds);
    const userIds = [...byUser.keys()];
    const verifierFlags = await this.loadVerifierFlags(userIds);
    return this.toEntries(byUser, metric, limit, verifierFlags);
  }

  private mapWeek(row: typeof leaderboardWeeks.$inferSelect): LeaderboardWeekRecord {
    return {
      id: row.id,
      weekId: row.weekId,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      finalizedAt: row.finalizedAt ?? null,
      publishedUrl: row.publishedUrl ?? null,
      updatedAt: row.updatedAt ?? null,
    };
  }

  async upsertWeek(input: UpsertLeaderboardWeekInput): Promise<LeaderboardWeekRecord> {
    await this.db
      .insert(leaderboardWeeks)
      .values({
        weekId: input.weekId,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        finalizedAt: input.finalizedAt ?? null,
        publishedUrl: input.publishedUrl ?? null,
        updatedAt: input.updatedAt ?? null,
      })
      .onConflictDoUpdate({
        target: leaderboardWeeks.weekId,
        set: {
          startedAt: input.startedAt,
          endedAt: input.endedAt,
          ...(input.finalizedAt !== undefined ? { finalizedAt: input.finalizedAt } : {}),
          ...(input.publishedUrl !== undefined ? { publishedUrl: input.publishedUrl } : {}),
          ...(input.updatedAt !== undefined ? { updatedAt: input.updatedAt } : {}),
        },
      });

    const row = await this.findWeekByWeekId(input.weekId);
    if (!row) throw new Error(`leaderboard week upsert gagal: ${input.weekId}`);
    return row;
  }

  async replaceEntriesForWeek(weekId: string, entries: LeaderboardEntry[]): Promise<void> {
    await this.db.delete(leaderboardWeekEntries).where(eq(leaderboardWeekEntries.weekId, weekId));
    if (entries.length === 0) return;
    await this.db.insert(leaderboardWeekEntries).values(
      entries.map((e) => ({
        weekId,
        userId: e.userId,
        rank: e.rank,
        username: e.username,
displayName: e.displayName,
        avatarUrl: e.avatarUrl,
        submittedPoints: e.submittedPoints,
        approvedPoints: e.approvedPoints,
        verificationPoints: e.verificationPoints,
        combined: e.combined,
        isVerifier: e.isVerifier,
      })),
    );
  }

  async listEntriesForWeek(weekId: string): Promise<LeaderboardEntry[]> {
    const rows = await this.db
      .select()
      .from(leaderboardWeekEntries)
      .where(eq(leaderboardWeekEntries.weekId, weekId))
      .orderBy(asc(leaderboardWeekEntries.rank), asc(leaderboardWeekEntries.username));
    return rows.map((r) => ({
      rank: r.rank,
      userId: r.userId,
      username: r.username,
displayName: r.displayName ?? null,
      avatarUrl: r.avatarUrl ?? null,
      submittedPoints: r.submittedPoints,
      approvedPoints: r.approvedPoints,
      verificationPoints: r.verificationPoints,
      combined: r.combined,
      isVerifier: r.isVerifier,
    }));
  }

  async findWeekByWeekId(weekId: string): Promise<LeaderboardWeekRecord | null> {
    const [row] = await this.db
      .select()
      .from(leaderboardWeeks)
      .where(and(eq(leaderboardWeeks.weekId, weekId), isNull(leaderboardWeeks.deletedAt)));
    return row ? this.mapWeek(row) : null;
  }

  async listUnfinalizedWeeksDue(now: Date): Promise<LeaderboardWeekRecord[]> {
    const rows = await this.db
      .select()
      .from(leaderboardWeeks)
      .where(
        and(
          isNull(leaderboardWeeks.finalizedAt),
          isNull(leaderboardWeeks.deletedAt),
          lte(leaderboardWeeks.endedAt, now),
        ),
      );
    return rows.map((r) => this.mapWeek(r));
  }

  async touchWeekUpdatedAt(weekId: string, at: Date): Promise<void> {
    await this.db
      .update(leaderboardWeeks)
      .set({ updatedAt: at })
      .where(eq(leaderboardWeeks.weekId, weekId));
  }
}