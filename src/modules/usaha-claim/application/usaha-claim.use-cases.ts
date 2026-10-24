import type { NotifyUserUseCase } from '@/modules/device/application/use-cases/notify-user.use-case';
import type { InboxNotificationType } from '@/modules/notification/domain/entities/notification.entity';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { ActivityEventRepository } from '@/modules/activity/domain/repositories/activity-event.repository';
import type { UsahaRepository } from '@/modules/usaha/domain/repositories/usaha.repository';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '@/shared/errors/app-error';
import {
  composeClaimRejectDisplay,
  type UsahaClaim,
} from '../domain/usaha-claim.entity';
import type { UsahaClaimRepository } from '../domain/usaha-claim.repository';

export class UsahaClaimUseCases {
  constructor(
    private readonly claims: UsahaClaimRepository,
    private readonly usahas: UsahaRepository,
    private readonly audit?: AuditLogRepository,
    private readonly inbox?: RecordInboxNotificationUseCase,
    private readonly notifyUser?: NotifyUserUseCase,
    private readonly activityEvents?: Pick<ActivityEventRepository, 'append'>,
  ) {}

  /** Ajukan klaim. Bukti kontak disimpan privat, tidak pernah ke publik. */
  async submit(
    userId: string,
    slug: string,
    input: { contactEvidence: string; note?: string | null },
  ): Promise<UsahaClaim> {
    if (!userId || userId === ANONIM_USER_ID) {
      throw new ForbiddenError(
        'LOGIN_REQUIRED',
        'Masuk dulu ya untuk mengajukan klaim',
      );
    }
    if (!input.contactEvidence?.trim()) {
      throw new BadRequestError(
        'EVIDENCE_REQUIRED',
        'Bukti kontak wajib diisi',
        [{ field: 'contact_evidence', message: 'Tulis cara admin menghubungimu' }],
      );
    }
    const usaha = await this.usahas.findBySlug(slug, { publicOnly: true });
    if (!usaha) {
      throw new NotFoundError('USAHA_NOT_FOUND', 'Usaha tidak ditemukan');
    }
    if (usaha.managerId === userId) {
      throw new ConflictError(
        'ALREADY_MANAGER',
        'Kamu sudah jadi pengelola usaha ini',
      );
    }
    const pending = await this.claims.findPendingByUser(usaha.id, userId);
    if (pending) {
      throw new ConflictError(
        'CLAIM_PENDING',
        'Klaim kamu untuk usaha ini masih menunggu tinjauan',
      );
    }
    return this.claims.create({
      usahaId: usaha.id,
      userId,
      contactEvidence: input.contactEvidence.trim(),
      note: input.note ?? null,
    });
  }

  mine(userId: string) {
    return this.claims.listByUser(userId);
  }

  /** Batalkan klaim sendiri saat masih pending. */
  async cancel(userId: string, id: string): Promise<void> {
    const row = await this.claims.findById(id);
    if (!row || row.userId !== userId) {
      throw new NotFoundError('CLAIM_NOT_FOUND', 'Klaim tidak ditemukan');
    }
    if (row.status !== 'pending') {
      throw new ConflictError(
        'NOT_PENDING',
        'Hanya klaim yang menunggu tinjauan yang bisa dibatalkan',
      );
    }
    await this.claims.setStatus(id, 'cancelled');
  }

  /** Antrean admin. Bukti kontak ikut karena ini endpoint admin. */
  listForAdmin(status: 'pending' | 'approved' | 'rejected' | 'cancelled') {
    return this.claims.listByStatus(status);
  }

  /** Satu klaim pending per pengelola: klaim lain otomatis ditolak. */
  async approve(
    id: string,
    actorId: string,
    requestId?: string | null,
  ): Promise<void> {
    const row = await this.claims.findById(id);
    if (!row) {
      throw new NotFoundError('CLAIM_NOT_FOUND', 'Klaim tidak ditemukan');
    }
    if (row.status !== 'pending') {
      throw new ConflictError('NOT_PENDING', 'Klaim sudah ditinjau');
    }
    await this.claims.approveExclusive(id, actorId);
    const usaha = await this.usahas.findById(row.usahaId);
    if (usaha) {
      await this.audit?.record({
        userId: actorId,
        action: 'usaha.claim.approve',
        entityType: 'usaha',
        entityId: usaha.id,
        newData: { claim_id: id, manager_id: row.userId },
        requestId: requestId ?? null,
      });
      // Jejak publik: pengelola terverifikasi mengelola usaha.
      try {
        await this.activityEvents?.append({
          kind: 'usaha_published',
          actorId: null,
          targetId: usaha.id,
          payload: `Usaha "${usaha.name}" kini dikelola pemiliknya`,
          dedupeKey: `usaha_claim_approved:${usaha.id}:${id}`,
        });
      } catch {
        /* best-effort */
      }
    }
    await this.notify(
      row.userId,
      'usaha_claim_approved',
      {
        title: 'Klaim usaha disetujui',
        body: `Kamu sekarang jadi pengelola "${usaha?.name ?? 'usaha ini'}". Buka Usaha Saya untuk mulai mengelola.`,
      },
      id,
      actorId,
    );
  }

  async reject(
    id: string,
    reasonCode: string,
    reasonText: string | null | undefined,
    actorId: string,
    requestId?: string | null,
  ): Promise<void> {
    const row = await this.claims.findById(id);
    if (!row) {
      throw new NotFoundError('CLAIM_NOT_FOUND', 'Klaim tidak ditemukan');
    }
    if (row.status !== 'pending') {
      throw new ConflictError('NOT_PENDING', 'Klaim sudah ditinjau');
    }
    await this.claims.setStatus(id, 'rejected', {
      rejectReasonCode: reasonCode,
      rejectReasonText: reasonText ?? null,
      reviewedBy: actorId,
    });
    await this.audit?.record({
      userId: actorId,
      action: 'usaha.claim.reject',
      entityType: 'usaha',
      entityId: row.usahaId,
      newData: { claim_id: id, reason_code: reasonCode },
      requestId: requestId ?? null,
    });
    await this.notify(
      row.userId,
      'usaha_claim_rejected',
      {
        title: 'Klaim usaha ditolak',
        body: `Klaim belum bisa disetujui. Alasan: ${composeClaimRejectDisplay(reasonCode, reasonText)}.`,
      },
      id,
      actorId,
    );
  }

  private async notify(
    userId: string,
    type: InboxNotificationType,
    copy: { title: string; body: string },
    claimId: string,
    actorId?: string,
  ): Promise<void> {
    if (!userId || userId === ANONIM_USER_ID) return;
    if (actorId && actorId === userId) return;
    try {
      await this.inbox?.execute({
        userId,
        type,
        targetKind: 'usaha_claim',
        targetId: claimId,
        title: copy.title,
        body: copy.body,
        actionKind: 'usaha_claim',
        actionValue: claimId,
        actorId,
      });
      await this.notifyUser?.execute({
        userId,
        title: copy.title,
        body: copy.body,
        data: { type, target_kind: 'usaha_claim', target_id: claimId },
        actorId,
      });
    } catch (err) {
      console.error(
        JSON.stringify({
          level: 'error',
          msg: 'notifikasi klaim usaha gagal',
          claim_id: claimId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}
