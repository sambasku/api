import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import type {
  ClosedLiveContribution,
  ContributionRepository,
} from '../../domain/repositories/contribution.repository';

/**
 * Samakan status Kontribusi Saya dengan kata yang sudah bercentang hijau.
 * Inbox memakai RecordInboxNotificationUseCase, yang sudah melewati
 * notifikasi ke diri sendiri (aktor = pengusul).
 */
export class SyncLiveWordContributionsUseCase {
  constructor(
    private readonly contributions: ContributionRepository,
    private readonly inbox?: Pick<RecordInboxNotificationUseCase, 'execute'>,
  ) {}

  /** Kata ini baru ditandai terverifikasi (masih hidup). */
  async closeLive(wordId: string, actorId: string): Promise<void> {
    const closed = await this.contributions.closePendingForLiveWord({ wordId, actorId });
    await this.notifyApproved(closed, actorId);
  }

  /**
   * Lemma digabung ke kata yang sudah tayang. Tutup usulan kata sumber
   * (biasanya sudah di-soft-delete) dan anak yang ikut pindah ke kata hidup.
   */
  async closeMerged(liveWordId: string, sourceWordId: string, actorId: string): Promise<void> {
    const live = await this.contributions.closePendingForLiveWord({ wordId: liveWordId, actorId });
    const source =
      liveWordId === sourceWordId
        ? []
        : await this.contributions.closePendingForLiveWord({
            wordId: sourceWordId,
            actorId,
            forceCloseWord: true,
          });
    await this.notifyApproved([...live, ...source], actorId);
  }

  /** Centang kuning lagi: usulan kata yang approved kembali menunggu. */
  async reopenUnverified(wordId: string): Promise<void> {
    await this.contributions.reopenApprovedWordContributions(wordId);
  }

  private async notifyApproved(rows: ClosedLiveContribution[], actorId: string): Promise<void> {
    if (!this.inbox) return;
    for (const row of rows) {
      await this.inbox.execute({
        userId: row.userId,
        type: 'contribution_approved',
        targetKind: 'contribution',
        targetId: row.id,
        actorId,
      });
    }
  }
}
