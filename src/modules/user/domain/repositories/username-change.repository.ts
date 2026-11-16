export interface UsernameChangeRow {
  id: string;
  userId: string;
  oldUsername: string;
  newUsername: string;
  changedAt: Date;
  holdUntil: Date;
  releasedAt: Date | null;
}

export interface UsernameChangeHistoryItem extends UsernameChangeRow {
  canReclaim: boolean;
}

export interface ApplyUsernameChangeInput {
  userId: string;
  oldUsername: string;
  newUsername: string;
  /** true = ganti ke handle baru (maju cooldown); false = reclaim. */
  advanceCooldown: boolean;
  now?: Date;
}

export interface UsernameChangeRepository {
  /** Hold aktif atas handle (released_at null + hold_until > now). */
  findActiveHold(
    username: string,
    now?: Date,
  ): Promise<{ userId: string; holdUntil: Date } | null>;

  /** Batch: username yang masih di-hold (untuk filter kandidat register). */
  listHeldUsernames(usernames: string[], now?: Date): Promise<Set<string>>;

  listHistoryForUser(
    userId: string,
    limit?: number,
    now?: Date,
  ): Promise<UsernameChangeHistoryItem[]>;

  /** Transaksi: update users.username (+ cooldown) + history + release reclaim target. */
  applyUsernameChange(input: ApplyUsernameChangeInput): Promise<void>;

  /** Soft-delete: lepas semua hold aktif user. */
  releaseActiveHoldsForUser(userId: string, now?: Date): Promise<void>;
}
