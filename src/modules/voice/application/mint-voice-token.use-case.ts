import {
  ForbiddenError,
  ServiceUnavailableError,
} from '@/shared/errors/app-error';
import { env } from '@/shared/config/env';
import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import { VOICE_ROOM_ENABLED_KEY } from '@/modules/chat/application/use-cases/chat.use-cases';
import { mintLivekitAccessToken } from '../infrastructure/livekit-token';

export interface MintVoiceTokenResult {
  token: string;
  url: string;
  room: string;
}

export class MintVoiceTokenUseCase {
  constructor(
    private readonly settingsRepo: AppSettingsRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async execute(userId: string): Promise<MintVoiceTokenResult> {
    const rows = await this.settingsRepo.getByKeys([VOICE_ROOM_ENABLED_KEY]);
    const raw = rows.find((r) => r.key === VOICE_ROOM_ENABLED_KEY)?.value;
    if (raw !== 'true') {
      throw new ForbiddenError(
        'VOICE_ROOM_DISABLED',
        'Voice room sedang dimatikan.',
      );
    }

    const url = env.LIVEKIT_URL?.trim();
    const apiKey = env.LIVEKIT_API_KEY?.trim();
    const apiSecret = env.LIVEKIT_API_SECRET?.trim();
    const room = (env.LIVEKIT_ROOM_NAME?.trim() || 'sambasku-global').trim();

    if (!url || !apiKey || !apiSecret) {
      throw new ServiceUnavailableError(
        'VOICE_UNAVAILABLE',
        'Voice room belum dikonfigurasi.',
      );
    }

    const user = await this.userRepo.findById(userId);
    const name = (
      user?.displayName?.trim() ||
      user?.username?.trim() ||
      `user-${userId.slice(0, 8)}`
    ).slice(0, 64);

    const token = await mintLivekitAccessToken({
      identity: userId,
      name,
      room,
      apiKey,
      apiSecret,
    });

    return { token, url, room };
  }
}
