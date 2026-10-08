import type { Announcement } from '../entities/announcement.entity';

export interface ListAnnouncementsInput {
  limit: number;
  before?: string; // ULID cursor
}

export interface ListAnnouncementsResult {
  items: Announcement[];
  nextCursor: string | null;
}

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  actionUrl?: string | null;
  actionLabel?: string | null;
  expiresAt?: Date | null;
  actorId: string;
}

export interface UpdateAnnouncementInput {
  id: string;
  title?: string;
  body?: string;
  actionUrl?: string | null;
  actionLabel?: string | null;
  expiresAt?: Date | null;
  actorId: string;
}

export interface AnnouncementRepository {
  create(input: CreateAnnouncementInput): Promise<Announcement>;
  findById(id: string): Promise<Announcement | null>;
  list(input: ListAnnouncementsInput): Promise<ListAnnouncementsResult>;
  update(input: UpdateAnnouncementInput): Promise<Announcement | null>;
  /** Soft delete. true = terhapus, false = tidak ditemukan/sudah terhapus. */
  delete(id: string): Promise<boolean>;
}
