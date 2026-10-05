import { ConflictError, NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { NotifyUserUseCase } from '@/modules/device/application/use-cases/notify-user.use-case';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { SendVerifierWaNotificationUseCase } from '@/modules/wa/application/use-cases/send-verifier-wa.use-case';
import { DEFAULT_WA_GROUP_CTA_URL } from '@/modules/legal/domain/entities/app-setting.entity';
import type { VerifierApplicationRepository } from '../../domain/repositories/verifier-application.repository';

export interface RejectVerifierApplicationCommand {
  applicationId: string;
  actorId: string;
  comment: string;
  requestId?: string | null;
}

export interface RejectVerifierApplicationResult {
  id: string;
  status: 'rejected';
}

const REJECT_TITLE = 'Pengajuan verifikator ditolak';

function rejectBody(comment: string): string {
  const trimmed = comment.trim();
  if (!trimmed) {
    return 'Pengajuan ditolak. Buka profil untuk memperbaiki.';
  }
  const max = 180;
  const snippet = trimmed.length > max ? `${trimmed.slice(0, max - 1)}...` : trimmed;
  return `Pengajuan ditolak: ${snippet}`;
}

export class RejectVerifierApplicationUseCase {
  constructor(
    private readonly appRepo: VerifierApplicationRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly notifyUser: NotifyUserUseCase,
    private readonly inbox: RecordInboxNotificationUseCase,
    private readonly userRepo?: UserRepository,
    private readonly sendVerifierWa?: SendVerifierWaNotificationUseCase,
    private readonly readWaSettings?: () => Promise<{ enabled: boolean; ctaUrl: string }>,
  ) {}

  async execute(cmd: RejectVerifierApplicationCommand): Promise<RejectVerifierApplicationResult> {
    const row = await this.appRepo.findById(cmd.applicationId);
    if (!row) {
      throw new NotFoundError(
        'VERIFIER_APPLICATION_NOT_FOUND',
        'Pengajuan verifikator tidak ditemukan',
      );
    }
    if (row.status !== 'pending') {
      throw new ConflictError(
        'APPLICATION_ALREADY_REVIEWED',
        'Pengajuan sudah memiliki keputusan',
      );
    }

    const updated = await this.appRepo.markRejected(row.id, cmd.actorId, cmd.comment);
    if (!updated) {
      throw new ConflictError(
        'APPLICATION_ALREADY_REVIEWED',
        'Pengajuan sudah memiliki keputusan',
      );
    }

    await this.auditRepo.record({
      userId: cmd.actorId,
      action: 'reject',
      entityType: 'verifier_application',
      entityId: row.id,
      oldData: { status: row.status },
      newData: { status: 'rejected', comment: cmd.comment },
      requestId: cmd.requestId ?? null,
    });

    const body = rejectBody(cmd.comment);

    await this.inbox.execute({
      userId: row.userId,
      type: 'verifier_application_rejected',
      targetKind: 'verifier_application',
      targetId: row.id,
      actorId: cmd.actorId,
      title: REJECT_TITLE,
      body,
    });

    await this.notifyUser.execute({
      userId: row.userId,
      title: REJECT_TITLE,
      body,
      actorId: cmd.actorId,
      data: {
        type: 'verifier_application_rejected',
        target_kind: 'verifier_application',
        target_id: row.id,
        application_id: row.id,
        title: REJECT_TITLE,
        body,
      },
    });

    await this.sendWaIfEnabled(row.userId, cmd.comment);

    return { id: row.id, status: 'rejected' };
  }

  /** WA opsional: gagal kirim tidak membatalkan penolakan. */
  private async sendWaIfEnabled(userId: string, comment: string): Promise<void> {
    if (!this.userRepo || !this.sendVerifierWa || !this.readWaSettings) return;
    try {
      const settings = await this.readWaSettings();
      if (!settings.enabled) return;
      const user = await this.userRepo.findById(userId);
      if (!user) return;
      // Alasan WA = admin_comment penuh (bukan snippet 180 char push).
      await this.sendVerifierWa.execute({
        userId,
        phone: user.phone,
        eventKey: 'verifier_application_rejected',
        displayName: user.displayName.trim() || user.username,
        detail: comment.trim() || 'Belum ada alasan spesifik, silakan ajukan ulang.',
        ctaUrl: settings.ctaUrl || DEFAULT_WA_GROUP_CTA_URL,
      });
    } catch (err) {
      console.error(
        JSON.stringify({
          level: 'error',
          msg: 'wa penolakan verifikator gagal dikirim',
          user_id: userId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}
