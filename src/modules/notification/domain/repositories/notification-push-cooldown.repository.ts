export type ReviewPushCooldownChannel = 'contribution_approved' | 'contribution_rejected';

/** Channel push yang di-throttle (review + diskusi komentar + vote kosakata). */
export type NotificationPushCooldownChannel =
  | ReviewPushCooldownChannel
  | 'word_comment'
  | 'word_vote'
  | 'discussion_reply';

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
