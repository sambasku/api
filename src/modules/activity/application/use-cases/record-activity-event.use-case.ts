import type { ActivityEventRepository } from '../../domain/repositories/activity-event.repository';
import type { ActivityEventKind } from '../../domain/entities/activity-event.entity';

export interface RecordActivityEventCommand {
  kind: ActivityEventKind;
  actorId?: string | null;
  targetWordId?: string | null;
  targetId?: string | null;
  occurredAt?: Date;
  dedupeKey?: string | null;
  /** Copy feed beku (mis. `"apam" sudah pas`) — null = fallback bodyFor. */
  payload?: string | null;
  /** true = sembunyikan event dengan dedupeKey sama (bukan append baru). */
  hidden?: boolean;
  /** #56/#110: nama pengusul utk copy verifikasi ('Memverifikasi: "kata" (usulan X)'). */
  proposedByName?: string | null;
}

/**
 * Tulis event aktivitas publik ke log `activity_events` (AGENTS.md #25).
 *
 * Dipanggil DI TITIK kejadian (approve/publish/vote/post), bukan dari read
 * path. Best-effort untuk feed: kegagalan tulis event TIDAK membatalkan
 * aksi utama - error di-swallow dengan console.error supaya UX kontribusi
 * tidak rusak hanya karena feed (event bisa di-backfill). Satu-satunya
 * pengecualian: pemanggil boleh memilih strict lewat construct kedua.
 */
export class RecordActivityEventUseCase {
  constructor(private readonly eventRepo: ActivityEventRepository) {}

  /** Fire-and-forget aman: return selalu void, tidak pernah throw. */
  async safe(cmd: RecordActivityEventCommand): Promise<void> {
    try {
      await this.eventRepo.append(cmd);
    } catch (err) {
      console.error('[activity-event] append gagal (diabaikan):', {
        kind: cmd.kind,
        targetId: cmd.targetId,
        err: err instanceof Error ? err.message : err,
      });
    }
  }

  /**
   * Sembunyikan event vote saat vote ditarik (baris votes dihapus hard).
   * Best-effort sama seperti append. `showAgain` untuk submit ulang.
   */
  async safeVoteVisibility(
    actorId: string,
    targetType: 'word' | 'comment',
    targetId: string,
  ): Promise<void> {
    try {
      await this.eventRepo.syncVoteVisibility(actorId, targetType, targetId);
    } catch (err) {
      console.error('[activity-event] syncVoteVisibility gagal (diabaikan):', {
        actorId,
        targetId,
        err: err instanceof Error ? err.message : err,
      });
    }
  }
}
