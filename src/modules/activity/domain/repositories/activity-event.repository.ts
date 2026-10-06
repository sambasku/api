import type { ActivityEventKind, AppendActivityEventInput } from '../entities/activity-event.entity';

/** Keyset cursor event: (occurredAt epoch detik, id). */
export interface ActivityEventCursor {
  occurredAt: number;
  id: string;
}

/** Hasil append untuk idempotensi caller. */
export type AppendResult = 'appended' | 'duplicate';

export interface ActivityEventRepository {
  /** Tulis satu event; dedupe_key bentrok = duplicate (bukan error). */
  append(input: AppendActivityEventInput): Promise<AppendResult>;

  /**
   * Sembunyikan event dari feed (soft, bukan delete) - dipakai saat vote
   * ditarik atau entitas target dibuat tak-layak tayang permanen.
   * `showAgain: true` mengembalikan event tersembunyi (vote di-submit ulang).
   */
  setHidden(
    kind: ActivityEventKind,
    actorId: string,
    targetId: string,
    hidden: boolean,
  ): Promise<void>;

  /** Toggle sesuai keberadaan sumber (vote ada = tampil, vote dihapus = sembunyi). */
  syncVoteVisibility(actorId: string, targetType: 'word' | 'comment', targetId: string): Promise<void>;
}
