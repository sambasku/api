import { NotFoundError } from '@/shared/errors/app-error';
import type { LeaderboardRepository } from '../../domain/repositories/leaderboard.repository';
import type { PublicUserRepository } from '@/modules/user/domain/repositories/public-user.repository';

export interface GetPointsHistoryInput {
  username: string;
  limit: number;
}

export interface GetPointsHistoryResult {
  username: string;
  history: Array<{
    week_id: string;
    submitted_points: number;
    approved_points: number;
    verification_points: number;
    combined: number;
    xp_at_week_end: number;
  }>;
}

export class GetPointsHistoryUseCase {
  constructor(
    private readonly leaderboardRepo: LeaderboardRepository,
    private readonly userRepo: PublicUserRepository,
  ) {}

  async execute(input: GetPointsHistoryInput): Promise<GetPointsHistoryResult> {
    const user = await this.userRepo.findPublicByUsername(input.username);
    if (!user) {
      throw new NotFoundError('USER_NOT_FOUND', 'User tidak ditemukan');
    }

    const stats = await this.leaderboardRepo.listUserWeekStats(user.id, input.limit);
    return {
      username: input.username,
      history: stats.map((s) => ({
        week_id: s.weekId,
        submitted_points: s.submittedPoints,
        approved_points: s.approvedPoints,
        verification_points: s.verificationPoints,
        combined: s.combined,
        xp_at_week_end: s.xpAtWeekEnd,
      })),
    };
  }
}