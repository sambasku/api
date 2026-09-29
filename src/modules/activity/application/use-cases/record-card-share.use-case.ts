import { NotFoundError } from '@/shared/errors/app-error';
import type { ActivityRepository } from '../../domain/repositories/activity.repository';

export class RecordCardShareUseCase {
  constructor(private readonly activityRepo: Pick<ActivityRepository, 'recordCardShare'>) {}

  /** `recorded: false` = sudah tercatat dalam 24 jam (idempoten, bukan error). */
  async execute(userId: string, wordId: string): Promise<{ recorded: boolean }> {
    const result = await this.activityRepo.recordCardShare(userId, wordId);
    if (result === 'word_not_found') {
      throw new NotFoundError('WORD_NOT_FOUND', 'Kata tidak ditemukan');
    }
    return { recorded: result === 'recorded' };
  }
}
