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
    createPlacement: vi.fn().mockResolvedValue({
      placementId: '01PLACEMENT00000000000001',
      creativeId: '01CREATIVE000000000000001',
    }),
    listAdmin: vi.fn(),
    getPlacementNotify: vi.fn(),
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
