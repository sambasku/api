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

/**
   * #187: sembunyikan event foto wisata yang dedupe_key-nya memuat `url`
   * (takedown admin). `instr`, bukan LIKE: `_` di URL bukan wildcard.
   */
  hidePlacePhoto(placeId: string, url: string): Promise<void>;

/** Toggle sesuai keberadaan sumber (vote ada = tampil, vote dihapus = sembunyi). */
syncVoteVisibility(
  actorId: string,
  targetType: 'word' | 'comment' | 'meaning',
  targetId: string,
): Promise<void>;
}
