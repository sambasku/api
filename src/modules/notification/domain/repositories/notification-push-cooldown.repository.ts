export type ReviewPushCooldownChannel = 'contribution_approved' | 'contribution_rejected';

/** Channel push yang di-throttle (review + diskusi komentar + vote kosakata). */
export type NotificationPushCooldownChannel =
  | ReviewPushCooldownChannel
  | 'word_comment'
  /** #387: push komentar foto. */
  | 'photo_comment'
  | 'word_vote'
  | 'article_clap'
  /** #133: notif media anak kata (contoh kalimat / audio pelafalan). */
  | 'word_media'
  | 'discussion_reply'
  | 'pantun_reply'
  /** #360: push mention chat, 1 per penerima per 60 detik. */
  | 'chat_mention';

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
