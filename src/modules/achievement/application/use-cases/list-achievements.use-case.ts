import type { AchievementRepository } from '../../domain/repositories/achievement.repository';
import type {
  AchievementWithOwnership,
  ListAchievementsResult,
} from '../../domain/entities/achievement.entity';
import {
  criteriaProgressSignature,
  effectiveAggregateThreshold,
  findAchievementSource,
} from '../../domain/achievement-registry';
import { countLeaderboardTopRepeats } from '../../domain/leaderboard-top-repeat';

/** Katalog publik (aktif saja) - tanpa auth. */
export class ListActiveAchievementsUseCase {
  constructor(private readonly repo: AchievementRepository) {}

  async execute(
    filter: Parameters<AchievementRepository['listActive']>[0],
  ): Promise<ListAchievementsResult> {
    return this.repo.listActive(filter);
  }
}

async function attachLeaderboardRepeatCounts(
  repo: AchievementRepository,
  userId: string,
  items: AchievementWithOwnership[],
): Promise<AchievementWithOwnership[]> {
  const needs = items.some(
    (item) =>
      item.userAchievementId != null && item.criteria.source === 'leaderboard_top',
  );
  if (!needs) {
    return items.map((item) =>
      item.criteria.source === 'leaderboard_top' && item.userAchievementId == null
        ? { ...item, repeatCount: null }
        : item,
    );
  }
  const ranks = await repo.listFinalizedLeaderboardRanks(userId);
  return items.map((item) => {
    if (item.userAchievementId == null || item.criteria.source !== 'leaderboard_top') {
      return item.criteria.source === 'leaderboard_top'
        ? { ...item, repeatCount: null }
        : item;
    }
    return {
      ...item,
      repeatCount: countLeaderboardTopRepeats(ranks, item.criteria),
    };
  });
}

/**
 * Katalog milik user: owned + locked dalam SATU query LEFT JOIN
 * (hemat subrequest). Filter reward_type untuk sub-tab Border.
 *
 * Locked + source agregat: isi `progress` (current/target) via batch COUNT
 * per signature criteria unik (ACHIEVEMENT_ENHANCEMENT G4).
 * Owned `leaderboard_top`: isi `repeatCount` dari snapshot finalized.
 */
export class ListMyAchievementsUseCase {
  constructor(private readonly repo: AchievementRepository) {}

  async execute(
    userId: string,
    filter: Parameters<AchievementRepository['listForUser']>[1],
  ): Promise<ListAchievementsResult> {
    const result = await this.repo.listForUser(userId, filter);
    const lockedAggregate = result.items.filter((item) => {
      if (item.userAchievementId != null) return false;
      const src = findAchievementSource(item.criteria.source);
      return src?.kind === 'aggregate';
    });

    let items: AchievementWithOwnership[] = result.items;
    if (lockedAggregate.length > 0) {
      // Dedupe signature (source+window+filters) supaya 10 tier kata = 1 COUNT.
      const signatureOrder: string[] = [];
      const signatureToCriteria = new Map<string, (typeof lockedAggregate)[0]['criteria']>();
      for (const item of lockedAggregate) {
        const sig = criteriaProgressSignature(item.criteria);
        if (!signatureToCriteria.has(sig)) {
          signatureToCriteria.set(sig, item.criteria);
          signatureOrder.push(sig);
        }
      }
      const criteriaList = signatureOrder.map((sig) => signatureToCriteria.get(sig)!);
      const counts = await this.repo.countUserAggregateProgressBatch(userId, criteriaList);
      const countBySig = new Map(signatureOrder.map((sig, i) => [sig, counts[i] ?? 0]));

      items = result.items.map((item) => {
        if (item.userAchievementId != null) return { ...item, progress: null };
        const src = findAchievementSource(item.criteria.source);
        if (src?.kind !== 'aggregate') return { ...item, progress: null };
        const current = countBySig.get(criteriaProgressSignature(item.criteria)) ?? 0;
        return {
          ...item,
          progress: {
            current,
            target: effectiveAggregateThreshold(item.criteria),
          },
        };
      });
    }

    items = await attachLeaderboardRepeatCounts(this.repo, userId, items);
    return { ...result, items };
  }
}

/** Badge profil publik: reward yang dimiliki user (endpoint per username). */
export class ListUserAchievementsUseCase {
  constructor(
    private readonly repo: AchievementRepository,
    private readonly findUserIdByUsername: (username: string) => Promise<string | null>,
  ) {}

  async execute(username: string): Promise<AchievementWithOwnership[]> {
    const userId = await this.findUserIdByUsername(username);
    if (!userId) return [];
    const owned = await this.repo.listOwnedByUser(userId);
    return attachLeaderboardRepeatCounts(this.repo, userId, owned);
  }
}
