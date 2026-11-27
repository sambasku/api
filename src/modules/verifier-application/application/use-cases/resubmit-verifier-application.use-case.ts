import { ConflictError, ForbiddenError, NotFoundError } from '@/shared/errors/app-error';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import {
  VERIFIER_APPLICATION_GROUP_EVENT_KEY,
  type ExplorationGroupNotifier,
} from '@/modules/wa/application/ports/exploration-group-notifier.port';
import type {
  SocialLink,
  SocialScreenshot,
  VerifierApplication,
  VerifierDialect,
} from '../../domain/entities/verifier-application.entity';
import { assertEnoughContributions } from '../assert-contribution-threshold';
import type { VerifierApplicationRepository } from '../../domain/repositories/verifier-application.repository';

export interface ResubmitVerifierApplicationCommand {
  userId: string;
  /** @deprecated Derived tertinggi dari roles (wire compat). */
  role: string;
  roles: string[];
  phone: string;
  address: string;
  socialLinks: SocialLink[];
  fullName: string;
  dialect: VerifierDialect;
  dialectNote: string | null;
  reason: string;
  photo: SocialScreenshot | null;
}

export class ResubmitVerifierApplicationUseCase {
  constructor(
    private readonly appRepo: VerifierApplicationRepository,
    private readonly userRepo: UserRepository,
    private readonly groupNotifier?: ExplorationGroupNotifier,
  ) {}

  async execute(cmd: ResubmitVerifierApplicationCommand): Promise<VerifierApplication> {
    if (cmd.roles.some((r) => r !== 'contributor')) {
      throw new ForbiddenError(
        'ALREADY_VERIFIER',
        'Hanya kontributor yang dapat memperbaiki pengajuan',
      );
    }

    const existing = await this.appRepo.findByUserId(cmd.userId);
    if (!existing) {
      throw new NotFoundError(
        'VERIFIER_APPLICATION_NOT_FOUND',
        'Pengajuan verifikator tidak ditemukan',
      );
    }
    if (existing.status !== 'rejected') {
      throw new ConflictError(
        'VERIFIER_APPLICATION_NOT_REJECTED',
        'Pengajuan hanya bisa diperbaiki setelah ditolak',
      );
    }

    const phoneOwner = await this.userRepo.findByPhone(cmd.phone);
    if (phoneOwner && phoneOwner.id !== cmd.userId) {
      throw new ConflictError('PHONE_ALREADY_EXISTS', 'Nomor HP sudah terdaftar');
    }

    await assertEnoughContributions(this.appRepo, cmd.userId);

    const updated = await this.appRepo.resubmitWithPhone(cmd.userId, {
      phone: cmd.phone,
      address: cmd.address,
      socialLinks: cmd.socialLinks,
      fullName: cmd.fullName,
      dialect: cmd.dialect,
      dialectNote: cmd.dialectNote,
      reason: cmd.reason,
      photo: cmd.photo,
    });
    if (!updated) {
      throw new ConflictError(
        'VERIFIER_APPLICATION_NOT_REJECTED',
        'Pengajuan hanya bisa diperbaiki setelah ditolak',
      );
    }

    await this.notifyGroup(updated.userId, updated.fullName ?? cmd.fullName);
    return updated;
  }

  private async notifyGroup(userId: string, fullName: string): Promise<void> {
    try {
      await this.groupNotifier?.notify({
        jenis: 'Pengajuan verifikator',
        name: fullName.trim() || 'tanpa nama',
        userId,
        resubmit: true,
        eventKey: VERIFIER_APPLICATION_GROUP_EVENT_KEY,
      });
    } catch {
      // Gagal kirim grup tidak membatalkan pengajuan.
    }
  }
}
