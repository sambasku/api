import { NotFoundError } from '@/shared/errors/app-error';
import type { UserSkipRepository } from '@/modules/user-skip/infrastructure/user-skip.repository';
import type { ContributionRepository } from '../../domain/repositories/contribution.repository';

/**
 * Lewati usulan di antrean review tanpa mengubah status dan tanpa
 * baris contribution_reviews. Idempoten. 404 jika kontribusi tidak ada.
 */
export class SkipContributionUseCase {
  constructor(
    private readonly contributions: ContributionRepository,
    private readonly skips: UserSkipRepository,
  ) {}

  async skip(userId: string, contributionId: string): Promise<void> {
    await this.requireExists(contributionId);
    await this.skips.record(userId, 'contribution', contributionId);
  }

  async unskip(userId: string, contributionId: string): Promise<void> {
    await this.requireExists(contributionId);
    await this.skips.clear(userId, 'contribution', contributionId);
  }

  private async requireExists(contributionId: string): Promise<void> {
    const row = await this.contributions.findById(contributionId);
    if (!row) {
      throw new NotFoundError(
        'CONTRIBUTION_NOT_FOUND',
        'Kontribusi dengan id tersebut tidak ditemukan',
      );
    }
  }
}
