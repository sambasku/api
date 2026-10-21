import type { AchievementRepository } from '../../domain/repositories/achievement.repository';
import type {
  AchievementWithOwnership,
  ListAchievementsResult,
} from '../../domain/entities/achievement.entity';

/** Katalog publik (aktif saja) - tanpa auth. */
export class ListActiveAchievementsUseCase {
  constructor(private readonly repo: AchievementRepository) {}

  async execute(
    filter: Parameters<AchievementRepository['listActive']>[0],
  ): Promise<ListAchievementsResult> {
    return this.repo.listActive(filter);
  }
}

/**
 * Katalog milik user: owned + locked dalam SATU query LEFT JOIN
 * (hemat subrequest). Filter reward_type untuk sub-tab Border.
 */
export class ListMyAchievementsUseCase {
  constructor(private readonly repo: AchievementRepository) {}

  async execute(
    userId: string,
    filter: Parameters<AchievementRepository['listForUser']>[1],
  ): Promise<ListAchievementsResult> {
    return this.repo.listForUser(userId, filter);
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
    return this.repo.listOwnedByUser(userId);
  }
}
