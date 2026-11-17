import { describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/logging/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { BalehoUseCases } from '../../application/baleho.use-cases';
import type { BalehoRepository } from '../../domain/repositories/baleho.repository';
import type { CreateBalehoPlacementInput } from '../../domain/baleho';

function frameInput(
  over: Partial<CreateBalehoPlacementInput['frames'][number]> = {},
): CreateBalehoPlacementInput['frames'][number] {
  return {
    mediaType: 'image',
    mediaUrl: 'https://cdn.example.com/a.jpg',
    title: 'Judul',
    ctaLabel: 'Buka',
    actionType: 'external',
    actionPayload: 'https://contoh.id',
    ...over,
  };
}

function placementInput(
  over: Partial<CreateBalehoPlacementInput> = {},
): CreateBalehoPlacementInput {
  return {
    slide: 1,
    col: 0,
    row: 0,
    w: 1,
    h: 1,
    days: 7,
    frames: [frameInput()],
    ...over,
  };
}

function mockRepo(partial: Partial<BalehoRepository> = {}): BalehoRepository {
  return {
    getBoard: vi.fn(),
    countActiveForUser: vi.fn().mockResolvedValue(0),
    hasActiveFingerprint: vi.fn().mockResolvedValue(false),
    findUserIdByUsername: vi.fn().mockResolvedValue(null),
    getCreativeForOwner: vi.fn(),
    countFrames: vi.fn().mockResolvedValue(1),
    listApprovedCreatives: vi.fn().mockResolvedValue([]),
    getLatestReferralForCreative: vi.fn().mockResolvedValue(null),
    createPlacement: vi.fn().mockResolvedValue({
      placementId: '01PLACEMENT00000000000001',
      creativeId: '01CREATIVE000000000000001',
    }),
    listAdmin: vi.fn(),
    listMine: vi.fn().mockResolvedValue([]),
    getPlacementNotify: vi.fn(),
    getPaymentProof: vi.fn().mockResolvedValue(null),
    updatePlacementStatus: vi.fn(),
    releaseDue: vi.fn().mockResolvedValue({ cancelled: 0, expired: 0 }),
    createCommissionUnclaimed: vi.fn(),
    recordEvent: vi.fn(),
    ...partial,
  } as BalehoRepository;
}

describe('BalehoUseCases.createPlacement', () => {
  it('tolak kuota 2 pesanan aktif', async () => {
    const repo = mockRepo({
      countActiveForUser: vi.fn().mockResolvedValue(2),
    });
    const uc = new BalehoUseCases(repo);
    await expect(
      uc.createPlacement('01USER000000000000000001', placementInput()),
    ).rejects.toMatchObject({ errorCode: 'BALEHO_ACTIVE_LIMIT' });
    expect(repo.createPlacement).not.toHaveBeenCalled();
  });

  it('tolak fingerprint seragam pada pesanan aktif', async () => {
    const repo = mockRepo({
      hasActiveFingerprint: vi.fn().mockResolvedValue(true),
    });
    const uc = new BalehoUseCases(repo);
    await expect(
      uc.createPlacement('01USER000000000000000001', placementInput()),
    ).rejects.toMatchObject({ errorCode: 'BALEHO_FINGERPRINT_DUP' });
    expect(repo.createPlacement).not.toHaveBeenCalled();
  });

  it('SLOT_TAKEN dari repo diteruskan (race overlap)', async () => {
    const { ConflictError } = await import('@/shared/errors/app-error');
    const repo = mockRepo({
      createPlacement: vi
        .fn()
        .mockRejectedValue(
          new ConflictError('SLOT_TAKEN', 'Area ini baru saja terisi.'),
        ),
    });
    const uc = new BalehoUseCases(repo);
    await expect(
      uc.createPlacement('01USER000000000000000001', placementInput()),
    ).rejects.toMatchObject({ errorCode: 'SLOT_TAKEN' });
  });

  it('buat placement pending_review bila lolos cek', async () => {
    const repo = mockRepo();
    const uc = new BalehoUseCases(repo);
    const result = await uc.createPlacement(
      '01USER000000000000000001',
      placementInput(),
    );
    expect(result.placementId).toBe('01PLACEMENT00000000000001');
    expect(repo.createPlacement).toHaveBeenCalledWith(
      expect.objectContaining({
        advertiserUserId: '01USER000000000000000001',
        status: 'pending_review',
        awaitingPaymentAt: null,
      }),
    );
  });

  it('reaktivasi: skip review, salin referrer lama', async () => {
    const repo = mockRepo({
      getCreativeForOwner: vi.fn().mockResolvedValue({
        id: '01CREATIVE000000000000001',
        ownerUserId: '01USER000000000000000001',
        fingerprint: 'fp-old',
        moderationStatus: 'approved',
      }),
      getLatestReferralForCreative: vi.fn().mockResolvedValue({
        referrerUserId: '01REF0000000000000000001',
        referralUsername: 'temanlama',
      }),
    });
    const uc = new BalehoUseCases(repo);
    await uc.createPlacement('01USER000000000000000001', {
      ...placementInput(),
      creativeId: '01CREATIVE000000000000001',
      frames: [],
      referralUsername: 'abaikan',
    });
    expect(repo.createPlacement).toHaveBeenCalledWith(
      expect.objectContaining({
        fingerprint: 'fp-old',
        status: 'awaiting_payment',
        referrerUserId: '01REF0000000000000000001',
        referralUsername: 'temanlama',
      }),
    );
  });
});

describe('BalehoUseCases.releaseDue', () => {
  it('meneruskan ke repo.releaseDue', async () => {
    const now = new Date('2026-01-15T12:00:00.000Z');
    const repo = mockRepo({
      releaseDue: vi.fn().mockResolvedValue({ cancelled: 2, expired: 1 }),
    });
    const uc = new BalehoUseCases(repo);
    await expect(uc.releaseDue(now)).resolves.toEqual({
      cancelled: 2,
      expired: 1,
    });
    expect(repo.releaseDue).toHaveBeenCalledWith(now);
  });
});

describe('BalehoUseCases.approve notify', () => {
  it('kirim inbox + FCM setelah status awaiting_payment', async () => {
    const placement = {
      id: '01PLACEMENT00000000000001',
      col: 0,
      row: 0,
      w: 1,
      h: 1,
      advertiserUserId: '01USER000000000000000001',
      status: 'pending_review',
      referrerUserId: null as string | null,
    };
    const repo = mockRepo({
      getPlacementNotify: vi.fn().mockResolvedValue(placement),
      updatePlacementStatus: vi.fn().mockResolvedValue(true),
    });
    const recordInbox = { execute: vi.fn().mockResolvedValue(undefined) };
    const notifyUser = { execute: vi.fn().mockResolvedValue(undefined) };
    const uc = new BalehoUseCases(repo, {
      recordInbox: recordInbox as never,
      notifyUser: notifyUser as never,
    });
    await uc.approve(placement.id);
    expect(recordInbox.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: placement.advertiserUserId,
        type: 'baleho_placement_approved',
        targetKind: 'baleho_placement',
        targetId: placement.id,
        actionKind: 'baleho_placement',
      }),
    );
    expect(notifyUser.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: placement.advertiserUserId,
        data: expect.objectContaining({
          type: 'baleho_placement_approved',
          target_kind: 'baleho_placement',
        }),
      }),
    );
  });
});

describe('BalehoUseCases.getPricing', () => {
  it('default 3000 bila settings kosong', async () => {
    const settingsRepo = { getValue: vi.fn().mockResolvedValue(null) };
    const uc = new BalehoUseCases(mockRepo(), {}, settingsRepo as never);
    await expect(uc.getPricing()).resolves.toEqual({
      pricePerCellPerDay: 3000,
    });
  });

  it('baca nilai dari app_settings', async () => {
    const settingsRepo = { getValue: vi.fn().mockResolvedValue('4500') };
    const uc = new BalehoUseCases(mockRepo(), {}, settingsRepo as never);
    await expect(uc.getPricing()).resolves.toEqual({
      pricePerCellPerDay: 4500,
    });
  });
});

describe('BalehoUseCases.createPlacement quote', () => {
  it('snapshot quoted_amount = w*h*days*tarif*slides', async () => {
    const create = vi.fn().mockResolvedValue({
      placementId: '01PLACEMENT00000000000009',
      creativeId: '01CREATIVE000000000000009',
    });
    const repo = mockRepo({ createPlacement: create });
    const settingsRepo = { getValue: vi.fn().mockResolvedValue('3000') };
    const uc = new BalehoUseCases(repo, {}, settingsRepo as never);
    await uc.createPlacement('01USER000000000000000009', placementInput({
      w: 2,
      h: 1,
      days: 7,
      frames: [frameInput(), frameInput({ mediaUrl: 'https://cdn.example.com/b.jpg' })],
    }));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        days: 7,
        pricePerCellPerDay: 3000,
        quotedAmount: 2 * 1 * 7 * 3000 * 2,
      }),
    );
  });

  it('reaktivasi: quote × jumlah frame creative lama', async () => {
    const create = vi.fn().mockResolvedValue({
      placementId: '01PLACEMENT00000000000010',
      creativeId: '01CREATIVE000000000000010',
    });
    const repo = mockRepo({
      createPlacement: create,
      getCreativeForOwner: vi.fn().mockResolvedValue({
        id: '01CREATIVE000000000000010',
        ownerUserId: '01USER000000000000000010',
        fingerprint: 'fp-react',
        moderationStatus: 'approved',
      }),
      countFrames: vi.fn().mockResolvedValue(3),
      getLatestReferralForCreative: vi.fn().mockResolvedValue(null),
    });
    const settingsRepo = { getValue: vi.fn().mockResolvedValue('3000') };
    const uc = new BalehoUseCases(repo, {}, settingsRepo as never);
    await uc.createPlacement('01USER000000000000000010', {
      ...placementInput({ w: 1, h: 1, days: 10 }),
      creativeId: '01CREATIVE000000000000010',
      frames: [],
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        quotedAmount: 1 * 1 * 10 * 3000 * 3,
      }),
    );
  });
});

describe('BalehoUseCases.getPaymentProofUrl', () => {
  it('404 bila belum ada bukti', async () => {
    const uc = new BalehoUseCases(mockRepo());
    await expect(uc.getPaymentProofUrl('01PLACEMENT00000000000001')).rejects.toMatchObject({
      errorCode: 'BALEHO_PAYMENT_PROOF_NOT_FOUND',
    });
  });

  it('kembalikan URL internal bila ada', async () => {
    const uc = new BalehoUseCases(
      mockRepo({
        getPaymentProof: vi.fn().mockResolvedValue({
          paymentProofUrl: 'https://ik.imagekit.io/x/baleho/payment-proofs/a.jpg',
          paymentProofFileId: 'file_1',
        }),
      }),
    );
    await expect(uc.getPaymentProofUrl('01PLACEMENT00000000000001')).resolves.toBe(
      'https://ik.imagekit.io/x/baleho/payment-proofs/a.jpg',
    );
  });
});

describe('BalehoUseCases.markPaid', () => {
  it('tolak tanpa bukti pembayaran', async () => {
    const uc = new BalehoUseCases(mockRepo());
    await expect(
      uc.markPaid('01PLACEMENT00000000000001', {
        paymentProofUrl: '',
        paymentProofFileId: '',
      }),
    ).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
  });

  it('simpan bukti lalu live', async () => {
    const placement = {
      id: '01PLACEMENT00000000000003',
      col: 0,
      row: 0,
      w: 1,
      h: 1,
      advertiserUserId: '01USER000000000000000003',
      status: 'awaiting_payment',
      referrerUserId: null as string | null,
    };
    const update = vi.fn().mockResolvedValue(true);
    const repo = mockRepo({
      getPlacementNotify: vi.fn().mockResolvedValue(placement),
      updatePlacementStatus: update,
    });
    const uc = new BalehoUseCases(repo);
    await uc.markPaid(placement.id, {
      paymentProofUrl: 'https://ik.imagekit.io/x/baleho/payment-proofs/a.jpg',
      paymentProofFileId: 'file_abc',
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        placementId: placement.id,
        status: 'live',
        paymentProofUrl:
          'https://ik.imagekit.io/x/baleho/payment-proofs/a.jpg',
        paymentProofFileId: 'file_abc',
      }),
    );
  });
});

describe('BalehoUseCases.reject notify', () => {
  it('kirim inbox + FCM setelah ditolak', async () => {
    const placement = {
      id: '01PLACEMENT00000000000002',
      col: 0,
      row: 0,
      w: 1,
      h: 1,
      advertiserUserId: '01USER000000000000000002',
      status: 'pending_review',
      referrerUserId: null as string | null,
    };
    const repo = mockRepo({
      getPlacementNotify: vi.fn().mockResolvedValue(placement),
      updatePlacementStatus: vi.fn().mockResolvedValue(true),
    });
    const recordInbox = { execute: vi.fn().mockResolvedValue(undefined) };
    const notifyUser = { execute: vi.fn().mockResolvedValue(undefined) };
    const uc = new BalehoUseCases(repo, {
      recordInbox: recordInbox as never,
      notifyUser: notifyUser as never,
    });
    await uc.reject(placement.id, 'konten tidak sesuai');
    expect(recordInbox.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'baleho_placement_rejected',
        userId: placement.advertiserUserId,
      }),
    );
    expect(notifyUser.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'baleho_placement_rejected' }),
      }),
    );
  });
});
