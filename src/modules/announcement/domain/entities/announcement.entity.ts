import type { ActivityEventKind } from '@/modules/activity/domain/entities/activity-event.entity';

/** Format isi pengumuman (#124 lanjutan). */
export type AnnouncementBodyType = 'plain' | 'html' | 'md' | 'webview';

/** Baris `announcements` (#102). */
export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  bodyType: AnnouncementBodyType;
  actionUrl: string | null;
  actionLabel: string | null;
  createdBy: string;
  expiresAt: Date | null;
  pinnedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
}

/** Bentuk bersih untuk admin console. */
export interface Announcement {
  id: string;
  title: string;
  body: string;
  bodyType: AnnouncementBodyType;
  actionUrl: string | null;
  actionLabel: string | null;
  createdBy: string;
  expiresAt: Date | null;
  pinnedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export const ANNOUNCEMENT_EVENT_KIND: ActivityEventKind = 'announcement';

/** Dedupe key event feed: satu baris feed per pengumuman (re-publish = tampil lagi). */
export function announcementDedupeKey(announcementId: string): string {
  return `announcement:${announcementId}`;
}
