import { BadRequestError } from '@/shared/errors/app-error';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { EmailVerificationOtpRepository } from '../../domain/repositories/email-verification-otp.repository';

/**
 * Verifikasi email manual oleh admin (mis. email OTP gagal terkirim ke user).
 * Perilaku sama dengan VerifyEmailUseCase sukses: tandai verified, hapus OTP,
 * catat event user_joined (dedupeKey sama - aman dipanggil dobel).
 */
export class AdminVerifyEmailUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly otpRepo: EmailVerificationOtpRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly activityEvents?: RecordActivityEventUseCase,
  ) {}

  async execute(cmd: {
    targetUserId: string;
    actorId: string;
    requestId?: string | null;
  }): Promise<{ id: string; emailVerifiedAt: Date }> {
    if (cmd.targetUserId === ANONIM_USER_ID) {
      throw new BadRequestError(
        'CANNOT_CHANGE_ANONIM',
        'User sistem anonim tidak bisa diubah. Itu akan menutup semua tamu.',
      );
    }

    const target = await this.userRepo.findById(cmd.targetUserId);
    if (!target || target.deletedAt) {
      throw new BadRequestError('USER_NOT_FOUND', 'Pengguna tidak ditemukan');
    }
    if (target.emailVerified) {
      throw new BadRequestError('ALREADY_VERIFIED', 'Email user ini sudah terverifikasi');
    }

    await this.userRepo.markEmailVerified(cmd.targetUserId);
    await this.otpRepo.deleteByUserId(cmd.targetUserId);
    const emailVerifiedAt = new Date();

    await this.auditRepo.record({
      userId: cmd.actorId,
      action: 'admin.user.email_verified',
      entityType: 'user',
      entityId: cmd.targetUserId,
      oldData: { email_verified: false },
      newData: { email_verified: true, username: target.username, email: target.email },
      requestId: cmd.requestId ?? null,
    });

    // Feed "Bergabung": momen akun terverifikasi (AGENTS #25). DedupeKey sama
    // dengan VerifyEmailUseCase supaya tidak dobel baris feed.
    await this.activityEvents?.safe({
      kind: 'user_joined',
      actorId: target.id,
      targetId: target.id,
      dedupeKey: `joined:${target.id}`,
    });

    return { id: target.id, emailVerifiedAt };
  }
}
