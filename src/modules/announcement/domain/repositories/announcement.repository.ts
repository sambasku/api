import type { Announcement, AnnouncementBodyType } from '../entities/announcement.entity';

export interface ListAnnouncementsInput {
  limit: number;
  before?: string; // ULID cursor
}

export interface ListAnnouncementsResult {
  items: Announcement[];
  nextCursor: string | null;
}

export interface CreateAnnouncementInput {
  bodyType?: AnnouncementBodyType;
  title: string;
  body: string;
  actionUrl?: string | null;
  actionLabel?: string | null;
  expiresAt?: Date | null;
  pinnedAt?: Date | null;
  actorId: string;
}

export interface UpdateAnnouncementInput {
  bodyType?: AnnouncementBodyType;
  id: string;
  title?: string;
  body?: string;
  actionUrl?: string | null;
  actionLabel?: string | null;
  expiresAt?: Date | null;
  pinnedAt?: Date | null;
  actorId: string;
}

export interface AnnouncementRepository {
  create(input: CreateAnnouncementInput): Promise<Announcement>;
  findById(id: string): Promise<Announcement | null>;
  list(input: ListAnnouncementsInput): Promise<ListAnnouncementsResult>;
  /** List pinned announcements (pinnedAt not null, not deleted, not expired). */
  listPinned(): Promise<Announcement[]>;
  update(input: UpdateAnnouncementInput): Promise<Announcement | null>;
  /** Soft delete. true = terhapus, false = tidak ditemukan/sudah terhapus. */
  delete(id: string): Promise<boolean>;
}
