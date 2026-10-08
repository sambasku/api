import { NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';
import type { Announcement } from '../../domain/entities/announcement.entity';
import { announcementDedupeKey } from '../../domain/entities/announcement.entity';
import type { AnnouncementRepository } from '../../domain/repositories/announcement.repository';

export interface CreateAnnouncementCommand {
  title: string;
  body: string;
  bodyType?: 'plain' | 'html' | 'md' | 'webview';
  actionUrl?: string | null;
  actionLabel?: string | null;
  expiresAt?: Date | null;
  actorId: string;
  requestId?: string | null;
}

// Admin membuat pengumuman (#102) - tayang di feed publik sebagai item
// kind `announcement` (write-through event, payload beku). Masa berlaku
// disaring read-time oleh feed repo, bukan saat write.
export class CreateAnnouncementUseCase {
  constructor(
    private readonly announcementRepo: AnnouncementRepository,
    private readonly activityEvents?: RecordActivityEventUseCase,
    private readonly auditRepo?: AuditLogRepository,
  ) {}

  async execute(cmd: CreateAnnouncementCommand): Promise<Announcement> {
    const announcement = await this.announcementRepo.create({
      title: cmd.title,
      body: cmd.body,
      bodyType: cmd.bodyType ?? 'plain',
      actionUrl: cmd.actionUrl ?? null,
      actionLabel: cmd.actionLabel ?? null,
      expiresAt: cmd.expiresAt ?? null,
      actorId: cmd.actorId,
    });

    // Write-through feed: payload beku = judul + isi + action (pola #94).
    await this.activityEvents?.safe({
      kind: 'announcement',
      actorId: cmd.actorId,
      targetId: announcement.id,
      dedupeKey: announcementDedupeKey(announcement.id),
      payload: JSON.stringify({
        title: announcement.title,
        body: announcement.body,
        bodyType: announcement.bodyType,
        actionUrl: announcement.actionUrl,
        actionLabel: announcement.actionLabel,
        expiresAt: announcement.expiresAt
          ? announcement.expiresAt.getTime()
          : null,
      }),
    });

    await this.auditRepo?.record({
      userId: cmd.actorId,
      action: 'create',
      entityType: 'announcement',
      entityId: announcement.id,
      newData: { title: announcement.title },
      requestId: cmd.requestId ?? null,
    });

    return announcement;
  }
}

export interface UpdateAnnouncementCommand {
  id: string;
  title?: string;
  body?: string;
  bodyType?: 'plain' | 'html' | 'md' | 'webview';
  actionUrl?: string | null;
  actionLabel?: string | null;
  expiresAt?: Date | null;
  pinnedAt?: Date | null; // set to now to pin, null to unpin
  actorId: string;
  requestId?: string | null;
}

// Edit pengumuman: update row + refresh copy beku event feed (re-publish
// dengan dedupeKey sama = event tampil lagi dengan payload baru).
export class UpdateAnnouncementUseCase {
  constructor(
    private readonly announcementRepo: AnnouncementRepository,
    private readonly activityEvents?: RecordActivityEventUseCase,
    private readonly auditRepo?: AuditLogRepository,
  ) {}

  async execute(cmd: UpdateAnnouncementCommand): Promise<Announcement> {
    const announcement = await this.announcementRepo.update({
      id: cmd.id,
      title: cmd.title,
      body: cmd.body,
      bodyType: cmd.bodyType,
      actionUrl: cmd.actionUrl,
      actionLabel: cmd.actionLabel,
      expiresAt: cmd.expiresAt,
      pinnedAt: cmd.pinnedAt,
      actorId: cmd.actorId,
    });
    if (!announcement) {
      throw new NotFoundError('ANNOUNCEMENT_NOT_FOUND', 'Pengumuman dengan id tersebut tidak ditemukan');
    }

    await this.activityEvents?.safe({
      kind: 'announcement',
      actorId: cmd.actorId,
      targetId: announcement.id,
      dedupeKey: announcementDedupeKey(announcement.id),
      payload: JSON.stringify({
        title: announcement.title,
        body: announcement.body,
        bodyType: announcement.bodyType,
        actionUrl: announcement.actionUrl,
        actionLabel: announcement.actionLabel,
        expiresAt: announcement.expiresAt
          ? announcement.expiresAt.getTime()
          : null,
      }),
    });

    await this.auditRepo?.record({
      userId: cmd.actorId,
      action: 'update',
      entityType: 'announcement',
      entityId: announcement.id,
      newData: { title: announcement.title },
      requestId: cmd.requestId ?? null,
    });

    return announcement;
  }
}

// Hapus pengumuman: soft delete row + hide event feed (dedupeKey sama,
// pola reject kontribusi). Riwayat audit tetap.
export class DeleteAnnouncementUseCase {
  constructor(
    private readonly announcementRepo: AnnouncementRepository,
    private readonly activityEvents?: RecordActivityEventUseCase,
    private readonly auditRepo?: AuditLogRepository,
  ) {}

  async execute(cmd: { id: string; actorId: string; requestId?: string | null }): Promise<void> {
    const ok = await this.announcementRepo.delete(cmd.id);
    if (!ok) {
      throw new NotFoundError('ANNOUNCEMENT_NOT_FOUND', 'Pengumuman dengan id tersebut tidak ditemukan');
    }

    await this.activityEvents?.safe({
      kind: 'announcement',
      actorId: cmd.actorId,
      targetId: cmd.id,
      dedupeKey: announcementDedupeKey(cmd.id),
      hidden: true,
    });

    await this.auditRepo?.record({
      userId: cmd.actorId,
      action: 'delete',
      entityType: 'announcement',
      entityId: cmd.id,
      newData: { deleted: true },
      requestId: cmd.requestId ?? null,
    });
  }
}

// List pinned announcements (mobile pinned page / carousel).
export class ListPinnedAnnouncementsUseCase {
  constructor(private readonly announcementRepo: AnnouncementRepository) {}

  async execute(): Promise<Announcement[]> {
    return this.announcementRepo.listPinned();
  }
}
