import { NotFoundError } from '@/shared/errors/app-error';
import type { WordRepository } from '@/modules/word/domain/repositories/word.repository';
import type { Contribution, ContributionReview } from '../../domain/entities/contribution.entity';
import type { ContributionRepository } from '../../domain/repositories/contribution.repository';

export interface ContributionDetail {
  contribution: Contribution;
  /** Keputusan terkini; null jika status pending (meski prior_reviews ada). */
  review: ContributionReview | null;
  /** Jejak append-only, terbaru dulu. */
  priorReviews: ContributionReview[];
  /** payload utuh entity - word: WordDetail semua status; anak: row + parent */
  entity: unknown;
}

// Detail satu kontribsi untuk layar review - entity 'word' dibaca lewat
// WordRepository (interface modul word, pola Section 4) supaya anak-anaknya
// ikut semua status; entity anak dibaca repository sendiri + referensi parent.
export class GetContributionDetailUseCase {
  constructor(
    private readonly contributionRepo: ContributionRepository,
    private readonly wordRepo: WordRepository,
  ) {}

  async execute(id: string): Promise<ContributionDetail> {
    const contribution = await this.contributionRepo.findById(id);
    if (!contribution) {
      throw new NotFoundError('CONTRIBUTION_NOT_FOUND', 'Kontribusi dengan id tersebut tidak ditemukan');
    }

    const priorReviews = await this.contributionRepo.listReviews(id);
    // Saat pending (termasuk setelah reopen), UI decide aktif → review null.
    const review = contribution.status === 'pending' ? null : (priorReviews[0] ?? null);

    let entity: unknown;
    if (contribution.entityType === 'word') {
      entity = await this.wordRepo.findDetailById(contribution.entityId, { includeAllStatuses: true });
    } else {
      entity = await this.contributionRepo.findChildWithParent(contribution.entityType, contribution.entityId);
    }

    return { contribution, review, priorReviews, entity };
  }
}
