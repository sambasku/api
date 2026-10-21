import { and, asc, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import {
  achievements,
  userAchievements,
  users,
} from '@/shared/database/drizzle/schema';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import { generateId } from '@/shared/utils/ulid';
import type {
  Achievement,
  AchievementCandidate,
  AchievementCriteria,
  AchievementWithOwnership,
  CreateAchievementInput,
  ListAchievementsFilter,
  ListAchievementsResult,
  UpdateAchievementInput,
} from '../domain/entities/achievement.entity';
import type {
  AchievementRepository,
  AwardTarget,
} from '../domain/repositories/achievement.repository';
import { findAchievementSource } from '../domain/achievement-registry';

type AchievementRow = typeof achievements.$inferSelect;

function parseCriteria(raw: string): AchievementCriteria {
  try {
    return JSON.parse(raw) as AchievementCriteria;
  } catch {
    // Baris rusak tidak boleh menjatuhkan seluruh katalog.
    return { source: 'manual' };
  }
}

function toDomain(row: AchievementRow): Achievement {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    category: row.category as Achievement['category'],
    rewardType: row.rewardType as Achievement['rewardType'],
    badgeUrl: row.badgeUrl ?? null,
    criteria: parseCriteria(row.criteria),
    family: row.family ?? null,
    level: row.level ?? null,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
  };
}

function toOwnership(
  row: AchievementRow,
  userAchievementId: string | null,
  awardedAt: Date | null,
): AchievementWithOwnership {
  return {
    ...toDomain(row),
    userAchievementId,
    awardedAt,
  };
}

/**
 * Implementasi repository achievement.
 *
 * Aturan read-path repo ini: tidak ada N+1. Katalog + status kepemilikan
 * diselesaikan satu query LEFT JOIN; profil publik border satu query.
 */
export class AchievementRepositoryImpl implements AchievementRepository {
  constructor(private readonly db: AppDatabase) {}

  // ------------------------------------------------------------- katalog --

  async create(
    input: CreateAchievementInput & { actorId: string },
  ): Promise<Achievement> {
    const [row] = await this.db
      .insert(achievements)
      .values({
        code: input.code,
        title: input.title,
        description: input.description,
        category: input.category,
        rewardType: input.rewardType,
        badgeUrl: input.badgeUrl,
        criteria: JSON.stringify(input.criteria),
        family: input.family,
        level: input.level,
        isActive: input.isActive,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return toDomain(row!);
  }

  async update(
    input: UpdateAchievementInput & { actorId: string },
  ): Promise<Achievement | null> {
    const values: Partial<typeof achievements.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.title !== undefined) values.title = input.title;
    if (input.description !== undefined) values.description = input.description;
    if (input.category !== undefined) values.category = input.category;
    if (input.rewardType !== undefined) values.rewardType = input.rewardType;
    if (input.badgeUrl !== undefined) values.badgeUrl = input.badgeUrl;
    if (input.criteria !== undefined) values.criteria = JSON.stringify(input.criteria);
    if (input.family !== undefined) values.family = input.family;
    if (input.level !== undefined) values.level = input.level;
    if (input.isActive !== undefined) values.isActive = input.isActive;

    // `code` sengaja tidak di-update: dipakai integrasi.
    const [row] = await this.db
      .update(achievements)
      .set(values)
      .where(and(eq(achievements.id, input.id), isNull(achievements.deletedAt)))
      .returning();
    return row ? toDomain(row) : null;
  }

  async softDelete(id: string, actorId: string): Promise<boolean> {
    const rows = await this.db
      .update(achievements)
      .set({ deletedAt: new Date(), deletedBy: actorId, updatedAt: new Date() })
      .where(and(eq(achievements.id, id), isNull(achievements.deletedAt)))
      .returning({ id: achievements.id });
    return rows.length > 0;
  }

  async findById(id: string): Promise<Achievement | null> {
    const [row] = await this.db
      .select()
      .from(achievements)
      .where(and(eq(achievements.id, id), isNull(achievements.deletedAt)))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async findByCode(code: string): Promise<Achievement | null> {
    const [row] = await this.db
      .select()
      .from(achievements)
      .where(and(eq(achievements.code, code), isNull(achievements.deletedAt)))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  private catalogConditions(
    filter: Omit<ListAchievementsFilter, 'onlyActive'>,
    onlyActive: boolean,
  ) {
    const conds = [isNull(achievements.deletedAt)];
    if (onlyActive) conds.push(eq(achievements.isActive, true));
    if (filter.rewardType) conds.push(eq(achievements.rewardType, filter.rewardType));
    if (filter.category) conds.push(eq(achievements.category, filter.category));
    if (filter.before) conds.push(lt(achievements.id, filter.before));
    return conds;
  }

  async listActive(
    filter: Omit<ListAchievementsFilter, 'onlyActive'>,
  ): Promise<ListAchievementsResult> {
    const rows = await this.db
      .select()
      .from(achievements)
      .where(and(...this.catalogConditions(filter, true)))
      .orderBy(desc(achievements.id))
      .limit(filter.limit + 1);

    const hasMore = rows.length > filter.limit;
    const page = hasMore ? rows.slice(0, filter.limit) : rows;
    return {
      items: page.map((r) => toOwnership(r, null, null)),
      nextCursor: hasMore && page.length > 0 ? page[page.length - 1]!.id : null,
      hasMore,
    };
  }

  async listAdmin(filter: ListAchievementsFilter) {
    // Satu query: katalog + hitung penerima via subquery skalar (bukan
    // loop count per baris).
    const recipientCount = sql<number>`(
      select count(*) from ${userAchievements} ua
      where ua.achievement_id = ${achievements.id} and ua.deleted_at is null
    )`.mapWith(Number);

    const rows = await this.db
      .select({ row: achievements, recipientCount })
      .from(achievements)
      .where(and(...this.catalogConditions(filter, filter.onlyActive ?? false)))
      .orderBy(desc(achievements.id))
      .limit(filter.limit + 1);

    const hasMore = rows.length > filter.limit;
    const page = hasMore ? rows.slice(0, filter.limit) : rows;
    return {
      items: page.map((r) => ({ ...toDomain(r.row), recipientCount: r.recipientCount })),
      nextCursor: hasMore && page.length > 0 ? page[page.length - 1]!.row.id : null,
      hasMore,
    };
  }

  async listForUser(
    userId: string,
    filter: Omit<ListAchievementsFilter, 'onlyActive'>,
  ): Promise<ListAchievementsResult> {
    const rows = await this.db
      .select({
        row: achievements,
        awardId: userAchievements.id,
        awardedAt: userAchievements.awardedAt,
        activeBorderId: users.activeBorderId,
      })
      .from(achievements)
      .leftJoin(
        userAchievements,
        and(
          eq(userAchievements.achievementId, achievements.id),
          eq(userAchievements.userId, userId),
          isNull(userAchievements.deletedAt),
        ),
      )
      .leftJoin(users, eq(users.id, userId))
      .where(and(...this.catalogConditions(filter, true)))
      .orderBy(desc(achievements.id))
      .limit(filter.limit + 1);

    const hasMore = rows.length > filter.limit;
    const page = hasMore ? rows.slice(0, filter.limit) : rows;
    return {
      items: page.map((r) => ({
        ...toOwnership(
          r.row,
          r.awardId ?? null,
          r.awardedAt ? new Date(r.awardedAt) : null,
        ),
        isActiveBorder: r.activeBorderId != null && r.activeBorderId === r.awardId,
      })),
      nextCursor: hasMore && page.length > 0 ? page[page.length - 1]!.row.id : null,
      hasMore,
    };
  }

  async listOwnedByUser(userId: string): Promise<AchievementWithOwnership[]> {
    const rows = await this.db
      .select({ row: achievements, awardId: userAchievements.id, awardedAt: userAchievements.awardedAt })
      .from(userAchievements)
      .innerJoin(achievements, eq(userAchievements.achievementId, achievements.id))
      .where(
        and(
          eq(userAchievements.userId, userId),
          isNull(userAchievements.deletedAt),
          isNull(achievements.deletedAt),
        ),
      )
      // Tier: level tertinggi per family dulu, lalu terbaru.
      .orderBy(desc(achievements.level), desc(userAchievements.awardedAt));

    return rows.map((r) => toOwnership(r.row, r.awardId, r.awardedAt));
  }

  async findAwardId(achievementId: string, userId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: userAchievements.id })
      .from(userAchievements)
      .where(
        and(
          eq(userAchievements.achievementId, achievementId),
          eq(userAchievements.userId, userId),
          isNull(userAchievements.deletedAt),
        ),
      )
      .limit(1);
    return row?.id ?? null;
  }

  async findOwnedAwardById(
    userId: string,
    awardId: string,
  ): Promise<{ awardId: string; code: string; rewardType: string } | null> {
    const [row] = await this.db
      .select({
        awardId: userAchievements.id,
        code: achievements.code,
        rewardType: achievements.rewardType,
      })
      .from(userAchievements)
      .innerJoin(achievements, eq(achievements.id, userAchievements.achievementId))
      .where(
        and(
          eq(userAchievements.id, awardId),
          eq(userAchievements.userId, userId),
          isNull(userAchievements.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async resolveUsernames(
    usernames: string[],
  ): Promise<Map<string, { id: string; username: string; displayName: string }>> {
    if (usernames.length === 0) return new Map();
    const rows = await this.db
      .select({ id: users.id, username: users.username, displayName: users.displayName })
      .from(users)
      .where(
        and(
          inArray(users.username, usernames),
          isNull(users.deletedAt),
          eq(users.isActive, true),
        ),
      );
    const out = new Map<string, { id: string; username: string; displayName: string }>();
    for (const r of rows) {
      out.set(r.username.toLowerCase(), {
        id: r.id,
        username: r.username,
        displayName: r.displayName || r.username,
      });
    }
    return out;
  }

  async insertAward(target: AwardTarget, grantedVia: 'scan' | 'admin'): Promise<boolean> {
    const rows = await this.insertAwards([target], grantedVia);
    return rows.length > 0;
  }

  async insertAwards(
    targets: AwardTarget[],
    grantedVia: 'scan' | 'admin',
  ): Promise<Array<{ id: string; userId: string }>> {
    if (targets.length === 0) return [];
    // Idempotent: UNIQUE (achievement_id, user_id) + onConflictDoNothing.
    // Satu INSERT multi-baris = 1 subrequest (aturan join-bukan-n-panggilan).
    const now = new Date();
    return this.db
      .insert(userAchievements)
      .values(
        targets.map((target) => ({
          achievementId: target.achievementId,
          userId: target.userId,
          awardedAt: now,
          grantedVia,
          context: target.context ? JSON.stringify(target.context) : null,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: userAchievements.id, userId: userAchievements.userId });
  }

  async revokeAward(awardId: string, actorId: string): Promise<boolean> {
    const rows = await this.db
      .update(userAchievements)
      .set({ deletedAt: new Date(), deletedBy: actorId })
      .where(and(eq(userAchievements.id, awardId), isNull(userAchievements.deletedAt)))
      .returning({
        id: userAchievements.id,
        achievementId: userAchievements.achievementId,
        userId: userAchievements.userId,
      });
    const revoked = rows[0];
    if (!revoked) return false;
    // Bila award ini border aktif user, lepas juga supaya pointer tidak
    // menunjuk award mati (profil tetap aman karena read sudah filter
    // deleted_at, tapi kolom bersih lebih baik untuk audit).
    await this.db
      .update(users)
      .set({ activeBorderId: null })
      .where(eq(users.activeBorderId, awardId));
    return true;
  }

  async countRecipients(achievementId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(userAchievements)
      .where(
        and(
          eq(userAchievements.achievementId, achievementId),
          isNull(userAchievements.deletedAt),
        ),
      );
    return row?.count ?? 0;
  }

  async listRecipients(
    achievementId: string,
    limit: number,
    before?: string,
  ): Promise<{
    items: Array<{
      awardId: string;
      userId: string;
      username: string;
      displayName: string;
      awardedAt: Date;
      grantedVia: string;
    }>;
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    // Satu JOIN: award + user (bukan N+1 per baris).
    const conds = [
      eq(userAchievements.achievementId, achievementId),
      isNull(userAchievements.deletedAt),
    ];
    if (before) conds.push(lt(userAchievements.id, before));
    const rows = await this.db
      .select({
        awardId: userAchievements.id,
        userId: users.id,
        username: users.username,
        displayName: users.displayName,
        awardedAt: userAchievements.awardedAt,
        grantedVia: userAchievements.grantedVia,
      })
      .from(userAchievements)
      .innerJoin(users, eq(users.id, userAchievements.userId))
      .where(and(...conds))
      .orderBy(desc(userAchievements.id))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: page.map((r) => ({
        awardId: r.awardId,
        userId: r.userId,
        username: r.username,
        displayName: r.displayName || r.username,
        awardedAt: r.awardedAt,
        grantedVia: r.grantedVia,
      })),
      nextCursor: hasMore && page.length > 0 ? page[page.length - 1]!.awardId : null,
      hasMore,
    };
  }

  // ------------------------------------------------------------ evaluasi --

  /**
   * Anti-join: user yang memenuhi kriteria source DAN belum punya award.
   * Semua pengecualian global (anonim / non-aktif / soft-deleted) di sini.
   */
  private candidateConditions(achievementId: string, criteria: AchievementCriteria) {
    const source = findAchievementSource(criteria.source);
    const match = source ? source.buildMatch(criteria) : sql`1 = 0`;
    return and(
      isNull(users.deletedAt),
      eq(users.isActive, true),
      sql`${users.id} <> ${ANONIM_USER_ID}`,
      match,
      sql`not exists (
        select 1 from ${userAchievements} ua
        where ua.achievement_id = ${achievementId}
          and ua.user_id = ${users.id}
          and ua.deleted_at is null
      )`,
    );
  }

  async findUnawardedCandidates(
    achievementId: string,
    criteria: AchievementCriteria,
    limit: number,
  ): Promise<AchievementCandidate[]> {
    const rows = await this.db
      .select({
        userId: users.id,
        username: users.username,
        displayName: users.displayName,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(this.candidateConditions(achievementId, criteria))
      // Id lama = deterministik; preview tidak butuh urutan lain.
      .orderBy(asc(users.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      userId: r.userId,
      username: r.username,
      displayName: r.displayName || r.username,
      matchedAt: r.createdAt,
    }));
  }

  async findUnawardedCandidatesBatch(
    items: Array<{ id: string; criteria: AchievementCriteria }>,
    limitPerAchievement: number,
  ): Promise<Map<string, AchievementCandidate[]>> {
    if (items.length === 0) return new Map();
    // db.batch = 1 roundtrip HTTP untuk semua SELECT (aturan
    // join-bukan-n-panggilan): N katalog tetap 1 subrequest network.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = (await this.db.batch(
      items.map((item) =>
        this.db
          .select({
            userId: users.id,
            username: users.username,
            displayName: users.displayName,
            createdAt: users.createdAt,
          })
          .from(users)
          .where(this.candidateConditions(item.id, item.criteria))
          .orderBy(asc(users.createdAt))
          .limit(limitPerAchievement),
      ) as any,
    )) as Array<{ userId: string; username: string; displayName: string | null; createdAt: Date }[]>;
    const map = new Map<string, AchievementCandidate[]>();
    items.forEach((item, i) => {
      map.set(
        item.id,
        (results[i] ?? []).map((r) => ({
          userId: r.userId,
          username: r.username,
          displayName: r.displayName || r.username,
          matchedAt: r.createdAt,
        })),
      );
    });
    return map;
  }

  async countUnawardedCandidates(
    achievementId: string,
    criteria: AchievementCriteria,
  ): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(users)
      .where(this.candidateConditions(achievementId, criteria));
    return row?.count ?? 0;
  }

  // -------------------------------------------------------------- border --

  async setActiveBorder(userId: string, awardId: string | null): Promise<void> {
    await this.db.update(users).set({ activeBorderId: awardId }).where(eq(users.id, userId));
  }

  async findActiveBorder(userId: string) {
    const [row] = await this.db
      .select({
        awardId: userAchievements.id,
        achievementId: achievements.id,
        code: achievements.code,
        title: achievements.title,
        badgeUrl: achievements.badgeUrl,
      })
      .from(users)
      .innerJoin(userAchievements, eq(userAchievements.id, users.activeBorderId))
      .innerJoin(achievements, eq(achievements.id, userAchievements.achievementId))
      .where(and(eq(users.id, userId), isNull(userAchievements.deletedAt)))
      .limit(1);
    return row ?? null;
  }
}

/** Helper untuk test/fixture: id ULID baru. */
export const newAchievementId = generateId;
