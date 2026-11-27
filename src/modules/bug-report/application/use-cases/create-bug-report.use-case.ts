import { ValidationError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import {
  BUG_REPORT_GROUP_EVENT_KEY,
  type ExplorationGroupNotifier,
} from '@/modules/wa/application/ports/exploration-group-notifier.port';
import type {
  BugReport,
  BugReportImage,
  BugReportPlatform,
  NewBugReport,
} from '../../domain/entities/bug-report.entity';
import type { BugReportRepository } from '../../domain/repositories/bug-report.repository';

export interface CreateBugReportCommand {
  userId: string | null;
  deviceId: string | null;
  description: string;
  images: BugReportImage[];
  appVersion: string | null;
  platform: BugReportPlatform | null;
  requestId?: string | null;
}

export class CreateBugReportUseCase {
  constructor(
    private readonly repo: BugReportRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly groupNotifier?: ExplorationGroupNotifier,
  ) {}

  async execute(cmd: CreateBugReportCommand): Promise<BugReport> {
    const description = cmd.description.trim();
    if (description.length < 10) {
      throw new ValidationError([
        { field: 'description', message: 'Keterangan wajib diisi minimal 10 karakter' },
      ]);
    }
    if (description.length > 2000) {
      throw new ValidationError([
        { field: 'description', message: 'Keterangan maksimal 2000 karakter' },
      ]);
    }
    if (cmd.images.length > 4) {
      throw new ValidationError([
        { field: 'images', message: 'Lampiran tidak boleh lebih dari 4 gambar' },
      ]);
    }
    for (const img of cmd.images) {
      if (!/^https?:\/\//i.test(img.url)) {
        throw new ValidationError([{ field: 'images', message: 'Alamat gambar tidak valid' }]);
      }
      if (!img.providerFileId.trim()) {
        throw new ValidationError([{ field: 'images', message: 'Alamat gambar tidak valid' }]);
      }
    }

    const input: NewBugReport = {
      userId: cmd.userId,
      deviceId: cmd.deviceId,
      description,
      images: cmd.images,
      appVersion: cmd.appVersion,
      platform: cmd.platform,
    };
    const row = await this.repo.create(input);

    await this.auditRepo.record({
      userId: cmd.userId,
      action: 'create',
      entityType: 'bug_report',
      entityId: row.id,
      newData: {
        status: row.status,
        is_anonymous: cmd.userId === null,
        image_count: cmd.images.length,
      },
      requestId: cmd.requestId ?? null,
    });

    await this.notifyGroup(cmd, description);
    return row;
  }

  private async notifyGroup(
    cmd: CreateBugReportCommand,
    description: string,
  ): Promise<void> {
    if (!this.groupNotifier) return;
    const meta = [
      cmd.platform,
      cmd.appVersion,
      cmd.images.length > 0 ? `${cmd.images.length} gambar` : null,
    ].filter((part): part is string => Boolean(part));
    const clipped =
      description.length > 500 ? `${description.slice(0, 500)}...` : description;
    const urls = cmd.images.map((img) => img.url).join('\n');
    try {
      await this.groupNotifier.notify({
        heading: 'Laporan masalah baru.',
        jenis: meta.length > 0 ? `Laporan masalah (${meta.join(', ')})` : 'Laporan masalah',
        name: urls ? `${clipped}\n${urls}` : clipped,
        userId: cmd.userId ?? ANONIM_USER_ID,
        eventKey: BUG_REPORT_GROUP_EVENT_KEY,
      });
    } catch {
      // Gagal kirim grup tidak membatalkan laporan.
    }
  }
}
