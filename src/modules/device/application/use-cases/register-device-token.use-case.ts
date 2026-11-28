import type {
  DevicePlatform,
  DeviceTokenRepository,
} from '../../domain/repositories/device-token.repository';

export class RegisterDeviceTokenUseCase {
  constructor(private readonly deviceTokenRepo: DeviceTokenRepository) {}

  async execute(input: {
    userId: string;
    udid: string;
    fcmToken: string;
    platform?: DevicePlatform;
  }): Promise<{ id: string; udid: string; platform: DevicePlatform }> {
    const platform = input.platform ?? 'android';
    const record = await this.deviceTokenRepo.register(
      input.userId,
      input.udid,
      input.fcmToken,
      platform,
    );
    return { id: record.id, udid: record.udid, platform: record.platform };
  }
}
