import { env } from '@/shared/config/env';
import { logger } from '@/shared/logging/logger';
import type { LeaderboardFilePayload } from '../domain/entities/leaderboard-entry.entity';
import type {
  LeaderboardPublishResult,
  LeaderboardStoragePort,
} from '../application/ports/leaderboard-storage.port';
import { GitHubLeaderboardStorageService } from './github-leaderboard-storage.service';

class NullLeaderboardStorageService implements LeaderboardStoragePort {
  readonly currentPublicUrl = null;

  weeklyPublicUrl(): string | null {
    return null;
  }

  async publishCurrent(_payload: LeaderboardFilePayload): Promise<LeaderboardPublishResult> {
    logger.warn('LEADERBOARD_GITHUB_* kosong - publikasi current.json dilewati');
    return { url: null };
  }

  async publishWeekly(_weekId: string, _payload: LeaderboardFilePayload): Promise<LeaderboardPublishResult> {
    logger.warn('LEADERBOARD_GITHUB_* kosong - publikasi weekly json dilewati');
    return { url: null };
  }
}

export function createLeaderboardStorage(): LeaderboardStoragePort {
  if (env.LEADERBOARD_GITHUB_URL && env.LEADERBOARD_GITHUB_TOKEN) {
    try {
      return new GitHubLeaderboardStorageService();
    } catch (err) {
      logger.warn({ err }, 'Leaderboard storage GitHub gagal diinisialisasi - pakai no-op');
      return new NullLeaderboardStorageService();
    }
  }
  logger.warn('LEADERBOARD_GITHUB_* tidak lengkap - leaderboard CDN nonaktif (DB tetap jalan)');
  return new NullLeaderboardStorageService();
}