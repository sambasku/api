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
      { field: 'position', message: 'Area keluar dari papan 4x5' },
    ]);
  }
  if (!input.creativeId && !input.frames.length) {
    throw new ValidationError([
      { field: 'frames', message: 'Minimal satu frame' },
    ]);
  }
  if (input.creativeId) return;
  const videoCount = input.frames.filter((f) => f.mediaType === 'video').length;
  if (videoCount > 0 && !(w === 4 && h === 2)) {
    throw new ValidationError([
      { field: 'frames', message: 'Video hanya untuk ukuran 4x2' },
    ]);
  }
  if (videoCount > 1) {
    throw new ValidationError([
      { field: 'frames', message: 'Maksimal satu video per pesanan' },
    ]);
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

export class BalehoUseCases {
  constructor(private readonly repo: BalehoRepository) {}

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
    const ok = await this.repo.updatePlacementStatus({
      placementId,
      status: 'awaiting_payment',
      awaitingPaymentAt: new Date(),
    });
    if (!ok) {
      throw new NotFoundError('BALEHO_PLACEMENT_NOT_FOUND', 'Pesanan tidak ditemukan');
    }
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
  }

  recordEvent(placementId: string, frameId: string | null, eventType: string) {
    return this.repo.recordEvent({ placementId, frameId, eventType });
  }
}
