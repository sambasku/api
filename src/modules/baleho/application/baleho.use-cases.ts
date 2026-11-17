import {
  BALEHO_COLS,
  BALEHO_MAX_ACTIVE_PER_USER,
  BALEHO_MAX_DAYS,
  BALEHO_MAX_H,
  BALEHO_MAX_W,
  BALEHO_ROWS,
} from '@/shared/database/drizzle/schema/baleho.schema';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors/app-error';
import type { MailerPort } from '@/modules/auth/application/ports/mailer.port';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { SendWaMessageUseCase } from '@/modules/wa/application/use-cases/send-wa-message.use-case';
import { logger } from '@/shared/logging/logger';
import type { CreateBalehoPlacementInput } from '../domain/baleho';
import type { BalehoRepository } from '../domain/repositories/baleho.repository';

function fingerprintOf(input: CreateBalehoPlacementInput): string {
  const parts = input.frames.map(
    (f) =>
      `${f.mediaType}|${f.mediaUrl ?? ''}|${f.title ?? ''}|${f.ctaLabel ?? ''}|${f.actionType}|${f.actionPayload}`,
  );
  return parts.join('||');
}

function assertRect(input: CreateBalehoPlacementInput) {
  const { col, row, w, h, slide } = input;
  if (slide !== 1 && slide !== 2) {
    throw new ValidationError([
      { field: 'slide', message: 'Slide hanya 1 atau 2' },
    ]);
  }
  if (slide !== 1) {
    throw new ForbiddenError(
      'BALEHO_SLIDE_NOT_SELLABLE',
      'Hanya slide 1 yang bisa dipesan',
    );
  }
  if (w < 1 || h < 1 || w > BALEHO_MAX_W || h > BALEHO_MAX_H) {
    throw new ValidationError([
      { field: 'size', message: 'Ukuran grid di luar batas (max 4x2)' },
    ]);
  }
  if (col < 0 || row < 0 || col + w > BALEHO_COLS || row + h > BALEHO_ROWS) {
    throw new ValidationError([
      { field: 'position', message: 'Area keluar dari papan 4x6' },
    ]);
  }
  if (!input.creativeId && !input.frames.length) {
    throw new ValidationError([
      { field: 'frames', message: 'Minimal satu frame' },
    ]);
  }
  if (input.creativeId) return;
  // v1: slide pesan hanya gambar (text_cta / video menyusul).
  for (const [i, f] of input.frames.entries()) {
    if (f.mediaType !== 'image') {
      throw new ValidationError([
        {
          field: `frames.${i}.media_type`,
          message: 'Versi ini hanya menerima gambar',
        },
      ]);
    }
    if (!f.mediaUrl?.trim()) {
      throw new ValidationError([
        {
          field: `frames.${i}.media_url`,
          message: 'Gambar wajib diunggah',
        },
      ]);
    }
  }
  for (const [i, f] of input.frames.entries()) {
    if (!f.actionPayload.trim()) {
      throw new ValidationError([
        { field: `frames.${i}.action_payload`, message: 'Action wajib diisi' },
      ]);
    }
    if (f.actionType === 'external') {
      try {
        const u = new URL(f.actionPayload);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
          throw new Error('bad proto');
        }
      } catch {
        throw new ValidationError([
          {
            field: `frames.${i}.action_payload`,
            message: 'URL eksternal tidak valid',
          },
        ]);
      }
    }
  }
}

export type BalehoNotifyDeps = {
  mailer?: MailerPort;
  sendWa?: SendWaMessageUseCase;
  userRepo?: UserRepository;
};

export class BalehoUseCases {
  constructor(
    private readonly repo: BalehoRepository,
    private readonly notify: BalehoNotifyDeps = {},
  ) {}

  getBoard(slide: number, viewerUserId: string | null) {
    if (slide !== 1 && slide !== 2) {
      throw new BadRequestError('BALEHO_BAD_SLIDE', 'Slide hanya 1 atau 2');
    }
    return this.repo.getBoard(slide, viewerUserId);
  }

  async createPlacement(advertiserUserId: string, input: CreateBalehoPlacementInput) {
    assertRect(input);

    const active = await this.repo.countActiveForUser(advertiserUserId);
    if (active >= BALEHO_MAX_ACTIVE_PER_USER) {
      throw new ConflictError(
        'BALEHO_ACTIVE_LIMIT',
        'Kamu sudah punya 2 pesanan aktif. Tunggu selesai atau dibatalkan dulu ya.',
      );
    }

    let referrerUserId: string | null = null;
    let referralUsername: string | null = null;
    const rawRef = input.referralUsername?.trim();
    if (rawRef) {
      const ref = await this.repo.findUserIdByUsername(rawRef);
      if (!ref || !ref.isActive) {
        throw new ValidationError([
          { field: 'referral_username', message: 'Username referral tidak ditemukan' },
        ]);
      }
      if (ref.id === advertiserUserId) {
        throw new ValidationError([
          { field: 'referral_username', message: 'Tidak boleh memakai username sendiri' },
        ]);
      }
      referrerUserId = ref.id;
      referralUsername = ref.username;
    }

    const days = Math.min(Math.max(input.days ?? BALEHO_MAX_DAYS, 1), BALEHO_MAX_DAYS);
    const fp = fingerprintOf(input);

    // Reaktivasi creative approved → skip review, awaiting_payment.
    if (input.creativeId) {
      const creative = await this.repo.getCreativeForOwner(
        input.creativeId,
        advertiserUserId,
      );
      if (!creative) {
        throw new NotFoundError('BALEHO_CREATIVE_NOT_FOUND', 'Creative tidak ditemukan');
      }
      if (creative.moderationStatus !== 'approved') {
        throw new BadRequestError(
          'BALEHO_CREATIVE_NOT_APPROVED',
          'Creative belum lolos moderasi',
        );
      }
      // Ikuti referrer lama: isi referral dari caller boleh diabaikan di fase ini
      // (placement baru tetap bisa bawa ref baru hanya jika creativeId kosong).
      // Spec: reaktivasi ikut referrer lama - caller harus kirim ref yang sama
      // atau kita biarkan null di sini dan admin/salin dari placement lama nanti.
      const endsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      return this.repo.createPlacement({
        advertiserUserId,
        input: { ...input, frames: [] },
        fingerprint: creative.fingerprint,
        referrerUserId,
        referralUsername,
        status: 'awaiting_payment',
        startsAt: null,
        endsAt,
        awaitingPaymentAt: new Date(),
      });
    }

    return this.repo.createPlacement({
      advertiserUserId,
      input,
      fingerprint: fp,
      referrerUserId,
      referralUsername,
      status: 'pending_review',
      startsAt: null,
      endsAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      awaitingPaymentAt: null,
    });
  }

  listAdmin(limit = 50) {
    return this.repo.listAdmin(limit);
  }

  async approve(placementId: string) {
    const row = await this.repo.getPlacementNotify(placementId);
    if (!row) {
      throw new NotFoundError('BALEHO_PLACEMENT_NOT_FOUND', 'Pesanan tidak ditemukan');
    }
    if (row.status !== 'pending_review') {
      throw new BadRequestError(
        'BALEHO_BAD_STATUS',
        'Hanya pesanan pending_review yang bisa disetujui',
      );
    }
    const ok = await this.repo.updatePlacementStatus({
      placementId,
      status: 'awaiting_payment',
      awaitingPaymentAt: new Date(),
    });
    if (!ok) {
      throw new NotFoundError('BALEHO_PLACEMENT_NOT_FOUND', 'Pesanan tidak ditemukan');
    }
    await this.notifyPayment(row);
  }

  async reject(placementId: string, reason?: string) {
    const ok = await this.repo.updatePlacementStatus({
      placementId,
      status: 'rejected',
      rejectReason: reason ?? null,
      clearOccupancy: true,
    });
    if (!ok) {
      throw new NotFoundError('BALEHO_PLACEMENT_NOT_FOUND', 'Pesanan tidak ditemukan');
    }
  }

  async markPaid(placementId: string) {
    const row = await this.repo.getPlacementNotify(placementId);
    if (!row) {
      throw new NotFoundError('BALEHO_PLACEMENT_NOT_FOUND', 'Pesanan tidak ditemukan');
    }
    if (row.status !== 'awaiting_payment') {
      throw new BadRequestError(
        'BALEHO_BAD_STATUS',
        'Hanya pesanan awaiting_payment yang bisa ditandai lunas',
      );
    }
    const now = new Date();
    const ok = await this.repo.updatePlacementStatus({
      placementId,
      status: 'live',
      paidAt: now,
      startsAt: now,
    });
    if (!ok) {
      throw new NotFoundError('BALEHO_PLACEMENT_NOT_FOUND', 'Pesanan tidak ditemukan');
    }
    // P3: ledger apresiasi referral (amount 0 dulu - rumus rate menyusul).
    if (row.referrerUserId) {
      await this.repo.createCommissionUnclaimed({
        placementId,
        referrerUserId: row.referrerUserId,
      });
    }
  }

  /** Pause/takedown live atau awaiting - lepaskan slot. */
  async pause(placementId: string, reason?: string) {
    const row = await this.repo.getPlacementNotify(placementId);
    if (!row) {
      throw new NotFoundError('BALEHO_PLACEMENT_NOT_FOUND', 'Pesanan tidak ditemukan');
    }
    if (row.status !== 'live' && row.status !== 'awaiting_payment') {
      throw new BadRequestError(
        'BALEHO_BAD_STATUS',
        'Hanya pesanan live atau awaiting_payment yang bisa di-pause',
      );
    }
    const ok = await this.repo.updatePlacementStatus({
      placementId,
      status: 'cancelled',
      rejectReason: reason ?? 'paused',
      clearOccupancy: true,
    });
    if (!ok) {
      throw new NotFoundError('BALEHO_PLACEMENT_NOT_FOUND', 'Pesanan tidak ditemukan');
    }
  }

  recordEvent(placementId: string, frameId: string | null, eventType: string) {
    return this.repo.recordEvent({ placementId, frameId, eventType });
  }

  private async notifyPayment(row: {
    id: string;
    col: number;
    row: number;
    w: number;
    h: number;
    advertiserUserId: string;
  }): Promise<void> {
    const { mailer, sendWa, userRepo } = this.notify;
    if (!mailer && !sendWa) return;
    if (!userRepo) return;
    try {
      const user = await userRepo.findById(row.advertiserUserId);
      if (!user) return;
      const displayName = user.displayName?.trim() || user.username;
      const sizeLabel = `${row.w}x${row.h}`;
      const positionLabel = `kolom ${row.col + 1}, baris ${row.row + 1}`;
      const payload = {
        displayName,
        placementId: row.id,
        sizeLabel,
        positionLabel,
      };
      if (mailer) {
        try {
          await mailer.sendBalehoPaymentEmail(user.email, payload);
        } catch (err) {
          logger.warn(
            { err: err instanceof Error ? err.message : String(err), placementId: row.id },
            'baleho email bayar gagal',
          );
        }
      }
      if (sendWa && user.phone) {
        const body = [
          `Halo ${displayName},`,
          'Pesanan Baleho kamu lolos cek dan menunggu pembayaran (48 jam).',
          `ID: ${row.id} · ${sizeLabel} · ${positionLabel}`,
          'Balas chat ini atau email kamu untuk instruksi rekening.',
        ].join('\n');
        try {
          await sendWa.execute({
            eventKey: 'baleho_payment',
            toPhone: user.phone,
            channel: 'text',
            bodyText: body,
            templateName: 'baleho_payment',
          });
        } catch (err) {
          logger.warn(
            { err: err instanceof Error ? err.message : String(err), placementId: row.id },
            'baleho WA bayar gagal',
          );
        }
      }
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err), placementId: row.id },
        'baleho notifikasi bayar gagal',
      );
    }
  }
}
