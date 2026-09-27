export type ReviewPushCooldownChannel = 'contribution_approved' | 'contribution_rejected';

/** Channel push yang di-throttle (review + diskusi komentar). */
export type NotificationPushCooldownChannel = ReviewPushCooldownChannel | 'word_comment';

export interface NotificationPushCooldown {
  userId: string;
  channel: NotificationPushCooldownChannel;
  lastPushAt: Date;
}

export interface NotificationPushCooldownRepository {
  get(
    userId: string,
    channel: NotificationPushCooldownChannel,
  ): Promise<NotificationPushCooldown | null>;
  touch(userId: string, channel: NotificationPushCooldownChannel, at?: Date): Promise<void>;
}
