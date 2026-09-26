export type ReviewPushCooldownChannel = 'contribution_approved' | 'contribution_rejected';

export interface NotificationPushCooldown {
  userId: string;
  channel: ReviewPushCooldownChannel;
  lastPushAt: Date;
}

export interface NotificationPushCooldownRepository {
  get(userId: string, channel: ReviewPushCooldownChannel): Promise<NotificationPushCooldown | null>;
  touch(userId: string, channel: ReviewPushCooldownChannel, at?: Date): Promise<void>;
}
