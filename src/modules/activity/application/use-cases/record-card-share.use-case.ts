import { NotFoundError } from '@/shared/errors/app-error';
import type { ActivityRepository } from '../../domain/repositories/activity.repository';
import type { ActivityEventRepository } from '../../domain/repositories/activity-event.repository';

export class RecordCardShareUseCase {
  constructor(
    private readonly activityRepo: Pick<ActivityRepository, 'recordCardShare'>,
    private readonly eventRepo?: ActivityEventRepository,
  ) {}

  /** `recorded: false` = sudah tercatat dalam 24 jam (idempoten, bukan error). */
  async execute(userId: string, wordId: string): Promise<{ recorded: boolean }> {
    const result = await this.activityRepo.recordCardShare(userId, wordId);
    if (result === 'word_not_found') {
      throw new NotFoundError('WORD_NOT_FOUND', 'Kata tidak ditemukan');
    }
    if (result === 'recorded') {
      // Event feed share kartu; dedupe harian selaras aturan 24 jam.
      try {
        await this.eventRepo?.append({
          kind: 'card_shared',
          actorId: userId,
          targetWordId: wordId,
          targetId: wordId,
          dedupeKey: `card_share:${userId}:${wordId}:${new Date().toISOString().slice(0, 10)}`,
        });
      } catch {
        /* best-effort: share sukses tetap sukses */
      }
    }
    return { recorded: result === 'recorded' };
  }
}
