import { describe, it, expect, vi } from 'vitest';
import { CSV_IMPORTER_USER_ID } from '@/shared/constants/csv-importer';
import { RegisterDeviceTokenUseCase } from '../../application/use-cases/register-device-token.use-case';
import { RevokeDeviceTokenUseCase } from '../../application/use-cases/revoke-device-token.use-case';
import { NotifyUserUseCase } from '../../application/use-cases/notify-user.use-case';
import { buildFcmMessagePayload } from '../../infrastructure/fcm-payload';
import { registerDeviceTokenSchema } from '../../presentation/v1/validators/device.validator';
import type { DeviceTokenRepository } from '../../domain/repositories/device-token.repository';
import type { PushSenderPort } from '../../application/ports/push-sender.port';

function makeDeviceRepo(overrides: Partial<DeviceTokenRepository> = {}): DeviceTokenRepository {
  return {
    register: vi.fn().mockImplementation(async (userId, udid, fcmToken, platform = 'android') => ({
      id: '01DEVICETOKENULID000000000',
      userId,
      udid,
      fcmToken,
      platform,
    })),
    revoke: vi.fn().mockResolvedValue(true),
    revokeAllForUser: vi.fn().mockResolvedValue(2),
    listActiveFcmTokensByUserId: vi.fn().mockResolvedValue(['fcm-a', 'fcm-b']),
    ...overrides,
  };
}

describe('RegisterDeviceTokenUseCase', () => {
  it('meneruskan userId/udid/fcmToken dengan default platform android', async () => {
    const repo = makeDeviceRepo();
    const useCase = new RegisterDeviceTokenUseCase(repo);
    const result = await useCase.execute({
      userId: '01USERULID0000000000000000',
      udid: 'udid-1',
      fcmToken: 'fcm-1',
    });
    expect(repo.register).toHaveBeenCalledWith(
      '01USERULID0000000000000000',
      'udid-1',
      'fcm-1',
      'android',
    );
    expect(result.udid).toBe('udid-1');
    expect(result.platform).toBe('android');
  });

  it('menyimpan platform ios saat dikirim dari client iOS', async () => {
    const repo = makeDeviceRepo();
    const useCase = new RegisterDeviceTokenUseCase(repo);
    const result = await useCase.execute({
      userId: '01USERULID0000000000000000',
      udid: 'udid-ios',
      fcmToken: 'fcm-ios',
      platform: 'ios',
    });
    expect(repo.register).toHaveBeenCalledWith(
      '01USERULID0000000000000000',
      'udid-ios',
      'fcm-ios',
      'ios',
    );
    expect(result.platform).toBe('ios');
  });
});

describe('registerDeviceTokenSchema', () => {
  it('default ke android bila platform tidak dikirim (backward-compatible)', () => {
    const parsed = registerDeviceTokenSchema.parse({ udid: 'u1', fcm_token: 't1' });
    expect(parsed.platform).toBe('android');
  });

  it('menerima platform ios dan menolak nilai asing', () => {
    expect(
      registerDeviceTokenSchema.parse({ udid: 'u1', fcm_token: 't1', platform: 'ios' }).platform,
    ).toBe('ios');
    expect(() =>
      registerDeviceTokenSchema.parse({ udid: 'u1', fcm_token: 't1', platform: 'web' }),
    ).toThrow();
  });
});

describe('buildFcmMessagePayload', () => {
  it('menyertakan blok apns alert + sound default untuk token iOS/Android', () => {
    const payload = buildFcmMessagePayload(
      { token: 'tok-1' },
      { title: 'Halo', body: 'Pesan', data: { type: 'comment' } },
    );
    expect(payload.message).toMatchObject({
      token: 'tok-1',
      notification: { title: 'Halo', body: 'Pesan' },
      apns: {
        headers: { 'apns-push-type': 'alert', 'apns-priority': '10' },
        payload: { aps: { sound: 'default' } },
      },
      data: { type: 'comment' },
    });
    expect(payload.message.apns.payload.aps).not.toHaveProperty('mutable-content');
  });

  it('menyertakan mutable-content dan fcm_options.image untuk rich image', () => {
    const payload = buildFcmMessagePayload(
      { topic: 'sambasku_campaigns_ios' },
      {
        title: 'Promo',
        body: 'Isi',
        bodyType: 'plain',
        imageUrl: 'https://cdn.sambasku.com/img.jpg',
      },
    );
    expect(payload.message).toMatchObject({
      topic: 'sambasku_campaigns_ios',
      android: { notification: { image: 'https://cdn.sambasku.com/img.jpg' } },
      apns: {
        payload: { aps: { sound: 'default', 'mutable-content': 1 } },
        fcm_options: { image: 'https://cdn.sambasku.com/img.jpg' },
      },
      data: { body_type: 'plain' },
    });
  });
});

describe('RevokeDeviceTokenUseCase', () => {
  it('mengembalikan revoked dari repository', async () => {
    const repo = makeDeviceRepo({ revoke: vi.fn().mockResolvedValue(false) });
    const useCase = new RevokeDeviceTokenUseCase(repo);
    const result = await useCase.execute({
      userId: '01USERULID0000000000000000',
      udid: 'missing',
    });
    expect(result.revoked).toBe(false);
  });
});

describe('NotifyUserUseCase', () => {
  it('skip jika push tidak dikonfigurasi', async () => {
    const repo = makeDeviceRepo();
    const push: PushSenderPort = {
      isConfigured: false,
      send: vi.fn(),
      sendToTopic: vi.fn(),
    };
    const useCase = new NotifyUserUseCase(repo, push);
    await useCase.execute({
      userId: '01USERULID0000000000000000',
      title: 't',
      body: 'b',
    });
    expect(repo.listActiveFcmTokensByUserId).not.toHaveBeenCalled();
    expect(push.send).not.toHaveBeenCalled();
  });

  it('skip jika actorId sama dengan penerima (self-notify)', async () => {
    const repo = makeDeviceRepo();
    const push: PushSenderPort = {
      isConfigured: true,
      send: vi.fn(),
      sendToTopic: vi.fn(),
    };
    const useCase = new NotifyUserUseCase(repo, push);
    const selfId = '01USERULID0000000000000000';
    await useCase.execute({
      userId: selfId,
      actorId: selfId,
      title: 't',
      body: 'b',
    });
    expect(repo.listActiveFcmTokensByUserId).not.toHaveBeenCalled();
    expect(push.send).not.toHaveBeenCalled();
  });

  it('skip pengimpor CSV', async () => {
    const repo = makeDeviceRepo();
    const push: PushSenderPort = {
      isConfigured: true,
      send: vi.fn(),
      sendToTopic: vi.fn(),
    };
    const useCase = new NotifyUserUseCase(repo, push);
    await useCase.execute({
      userId: CSV_IMPORTER_USER_ID,
      title: 't',
      body: 'b',
    });
    expect(repo.listActiveFcmTokensByUserId).not.toHaveBeenCalled();
    expect(push.send).not.toHaveBeenCalled();
  });

  it('fan-out ke semua token aktif', async () => {
    const repo = makeDeviceRepo();
    const push: PushSenderPort = {
      isConfigured: true,
      send: vi.fn().mockResolvedValue({ success: ['fcm-a', 'fcm-b'], failed: [] }),
      sendToTopic: vi.fn(),
    };
    const useCase = new NotifyUserUseCase(repo, push);
    await useCase.execute({
      userId: '01USERULID0000000000000000',
      title: 'Kontribusi disetujui',
      body: 'Usulan Anda telah disetujui.',
      data: { type: 'contribution_approved' },
    });
    expect(push.send).toHaveBeenCalledWith(
      ['fcm-a', 'fcm-b'],
      expect.objectContaining({ title: 'Kontribusi disetujui' }),
    );
  });
});
