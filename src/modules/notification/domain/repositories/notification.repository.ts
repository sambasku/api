import type {
  InboxNotification,
  InboxNotificationType,
  NotificationActionKind,
  NotificationTargetKind,
} from '../entities/notification.entity';

export interface CreateInboxNotificationInput {
  userId: string;
  type: InboxNotificationType;
  title: string;
  body: string;
  targetKind: NotificationTargetKind;
  targetId: string;
  actionKind?: NotificationActionKind | null;
  actionValue?: string | null;
}

export interface NotificationListOptions {
  limit: number;
  cursor?: string;
  unreadOnly?: boolean;
}

export interface NotificationListResult {
  items: InboxNotification[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface NotificationRepository {
  create(input: CreateInboxNotificationInput): Promise<void>;
  /** Insert banyak baris; conflict diabaikan (unique user+type+target). */
  createMany(inputs: CreateInboxNotificationInput[]): Promise<number>;
  /** Insert, atau timpa baris yang sama lalu tandai belum dibaca. */
  upsertUnread(input: CreateInboxNotificationInput): Promise<void>;
  listByUser(userId: string, opts: NotificationListOptions): Promise<NotificationListResult>;
  countUnread(userId: string): Promise<number>;
  markRead(userId: string, id: string): Promise<'updated' | 'already_read' | 'not_found'>;
  markAllRead(userId: string): Promise<number>;
}
