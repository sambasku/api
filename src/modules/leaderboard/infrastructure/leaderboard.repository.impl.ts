import { and, asc, eq, gte, inArray, isNotNull, isNull, lt, lte, ne, notInArray, sql } from 'drizzle-orm';
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
} from '@/shared/database/drizzle/schema';
import { SYSTEM_USER_IDS, isSystemUserId } from '@/shared/constants/system-users';
import { isVerifierRole } from '@/modules/word/application/utils/resolve-publication';
import { TOP_N } from '../domain/utils/iso-week';
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

function assignCompetitionRanks(entries: LeaderboardEntry[], metric: LeaderboardMetric): void {
  let pos = 0;
  let rank = 0;
  let prev: number | null = null;
  for (const e of entries) {
    pos += 1;
    const score = e[metric];
    if (prev === null || score !== prev) {
      rank = pos;
      prev = score;
    }
    e.rank = rank;
  }
}

function sortByMetric(entries: LeaderboardEntry[], metric: LeaderboardMetric): LeaderboardEntry[] {
  const sorted = [...entries].sort((a, b) => {
    const diff = b[metric] - a[metric];
    if (diff !== 0) return diff;
    return a.username.localeCompare(b.username);
  });
  assignCompetitionRanks(sorted, metric);
  return sorted;
}

export class LeaderboardRepositoryImpl implements LeaderboardRepository {
  constructor(private readonly db: AppDatabase) {}

  async listExcludedUserIds(): Promise<string[]> {
    const rows = await this.db
      .select({ userId: leaderboardExcludedUsers.userId })
      .from(leaderboardExcludedUsers);
    if (rows.length === 0) {
      return [...SYSTEM_USER_IDS];
    }
    return rows.map((r) => r.userId);
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

  private async aggregateWindow(
    startedAt: Date,
    endedAt: Date,
    excludedUserIds: string[],
  ): Promise<Map<
    string,
    { userId: string; username: string; avatarUrl: string | null; contributions: number; verifications: number }
  >> {
    const byUser = new Map<
      string,
      { userId: string; username: string; avatarUrl: string | null; contributions: number; verifications: number }
    >();

    const contributionRows = await this.db
      .select({
        userId: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
        count: sql<number>`count(distinct ${contributions.id})`.mapWith(Number),
      })
      .from(contributions)
      .innerJoin(
        contributionReviews,
        and(
          eq(contributionReviews.contributionId, contributions.id),
          inArray(contributionReviews.status, ['approved', 'corrected']),
          isNull(contributionReviews.deletedAt),
          gte(contributionReviews.createdAt, startedAt),
          lt(contributionReviews.createdAt, endedAt),
        ),
      )
      .innerJoin(users, eq(users.id, contributions.userId))
      .where(
        and(
          inArray(contributions.status, ['approved', 'corrected']),
          isNull(contributions.deletedAt),
          buildActiveUserFilter(excludedUserIds),
        ),
      )
      .groupBy(users.id, users.username, users.avatarUrl);

    for (const row of contributionRows) {
      byUser.set(row.userId, {
        userId: row.userId,
        username: row.username,
        avatarUrl: row.avatarUrl ?? null,
        contributions: row.count,
        verifications: 0,
      });
    }

    const verificationRows = await this.db
      .select({
        userId: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(contributionReviews)
      .innerJoin(users, eq(users.id, contributionReviews.reviewerId))
      .where(
        and(
          ne(contributionReviews.status, 'pending'),
          isNull(contributionReviews.deletedAt),
          isNotNull(contributionReviews.reviewerId),
          gte(contributionReviews.createdAt, startedAt),
          lt(contributionReviews.createdAt, endedAt),
          buildActiveUserFilter(excludedUserIds),
        ),
      )
      .groupBy(users.id, users.username, users.avatarUrl);

    for (const row of verificationRows) {
      const existing = byUser.get(row.userId);
      if (existing) {
        existing.verifications = row.count;
        if (!existing.avatarUrl && row.avatarUrl) existing.avatarUrl = row.avatarUrl;
      } else {
        byUser.set(row.userId, {
          userId: row.userId,
          username: row.username,
          avatarUrl: row.avatarUrl ?? null,
          contributions: 0,
          verifications: row.count,
        });
      }
    }

    return byUser;
  }

  private async aggregateAllTime(
    excludedUserIds: string[],
  ): Promise<
    Map<
      string,
      { userId: string; username: string; avatarUrl: string | null; contributions: number; verifications: number }
    >
  > {
    const byUser = new Map<
      string,
      { userId: string; username: string; avatarUrl: string | null; contributions: number; verifications: number }
    >();

    const contributionRows = await this.db
      .select({
        userId: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
        count: sql<number>`count(distinct ${contributions.id})`.mapWith(Number),
      })
      .from(contributions)
      .innerJoin(
        contributionReviews,
        and(
          eq(contributionReviews.contributionId, contributions.id),
          inArray(contributionReviews.status, ['approved', 'corrected']),
          isNull(contributionReviews.deletedAt),
        ),
      )
      .innerJoin(users, eq(users.id, contributions.userId))
      .where(
        and(
          inArray(contributions.status, ['approved', 'corrected']),
          isNull(contributions.deletedAt),
          buildActiveUserFilter(excludedUserIds),
        ),
      )
      .groupBy(users.id, users.username, users.avatarUrl);

    for (const row of contributionRows) {
      byUser.set(row.userId, {
        userId: row.userId,
        username: row.username,
        avatarUrl: row.avatarUrl ?? null,
        contributions: row.count,
        verifications: 0,
      });
    }

    const verificationRows = await this.db
      .select({
        userId: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(contributionReviews)
      .innerJoin(users, eq(users.id, contributionReviews.reviewerId))
      .where(
        and(
          ne(contributionReviews.status, 'pending'),
          isNull(contributionReviews.deletedAt),
          isNotNull(contributionReviews.reviewerId),
          buildActiveUserFilter(excludedUserIds),
        ),
      )
      .groupBy(users.id, users.username, users.avatarUrl);

    for (const row of verificationRows) {
      const existing = byUser.get(row.userId);
      if (existing) {
        existing.verifications = row.count;
      } else {
        byUser.set(row.userId, {
          userId: row.userId,
          username: row.username,
          avatarUrl: row.avatarUrl ?? null,
          contributions: 0,
          verifications: row.count,
        });
      }
    }

    return byUser;
  }

  private toEntries(
    byUser: Map<
      string,
      { userId: string; username: string; avatarUrl: string | null; contributions: number; verifications: number }
    >,
    metric: LeaderboardMetric,
    limit: number,
    verifierFlags: Map<string, boolean>,
  ): LeaderboardEntry[] {
    const draft: LeaderboardEntry[] = [];
    for (const row of byUser.values()) {
      const combined = row.contributions + row.verifications;
      if (combined <= 0 && metric === 'combined') continue;
      if (metric === 'contributions' && row.contributions <= 0) continue;
      if (metric === 'verifications' && row.verifications <= 0) continue;
      draft.push({
        rank: 0,
        userId: row.userId,
        username: row.username,
        avatarUrl: row.avatarUrl,
        contributions: row.contributions,
        verifications: row.verifications,
        combined,
        isVerifier: verifierFlags.get(row.userId) ?? false,
      });
    }
    const sorted = sortByMetric(draft, metric);
    return sorted.slice(0, limit);
  }

  async computeScoresForWindow(startedAt: Date, endedAt: Date): Promise<LeaderboardEntry[]> {
    const excludedUserIds = await this.listExcludedUserIds();
    const byUser = await this.aggregateWindow(startedAt, endedAt, excludedUserIds);
    const sortedDraft = sortByMetric(
      [...byUser.values()].map((row) => ({
        rank: 0,
        userId: row.userId,
        username: row.username,
        avatarUrl: row.avatarUrl,
        contributions: row.contributions,
        verifications: row.verifications,
        combined: row.contributions + row.verifications,
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
    const byUser = await this.aggregateAllTime(excludedUserIds);
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
        avatarUrl: e.avatarUrl,
        contributions: e.contributions,
        verifications: e.verifications,
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
      avatarUrl: r.avatarUrl ?? null,
      contributions: r.contributions,
      verifications: r.verifications,
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