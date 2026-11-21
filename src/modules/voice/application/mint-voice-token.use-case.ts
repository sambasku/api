import {
  BadRequestError,
  ForbiddenError,
  ServiceUnavailableError,
} from '@/shared/errors/app-error';
import { env } from '@/shared/config/env';
import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import { VOICE_ROOM_ENABLED_KEY } from '@/modules/chat/application/use-cases/chat.use-cases';
import { mintLivekitAccessToken } from '../infrastructure/livekit-token';
import {
  assertVoiceRoomJoinAllowed,
  VOICE_ROOM_MAX_PARTICIPANTS,
} from '../infrastructure/livekit-room-service';

export interface MintVoiceTokenResult {
  token: string;
  url: string;
  room: string;
  maxParticipants: number;
}

export type VoiceRoomGate = typeof assertVoiceRoomJoinAllowed;

export class MintVoiceTokenUseCase {
  constructor(
    private readonly settingsRepo: AppSettingsRepository,
    private readonly userRepo: UserRepository,
    /** Injectable untuk unit test. */
    private readonly roomGate: VoiceRoomGate = assertVoiceRoomJoinAllowed,
  ) {}

  async execute(
    userId: string,
    deviceId: string,
  ): Promise<MintVoiceTokenResult> {
    const trimmedDevice = deviceId.trim();
    if (!trimmedDevice || trimmedDevice.length > 64) {
      throw new BadRequestError(
        'DEVICE_ID_REQUIRED',
        'Device id wajib untuk gabung voice.',
      );
    }
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

    // Wajib: health + kapasitas + anti multi-device sebelum mint.
    await this.roomGate({
      wsUrl: url,
      apiKey,
      apiSecret,
      room,
      identity: userId,
      deviceId: trimmedDevice,
      maxParticipants: VOICE_ROOM_MAX_PARTICIPANTS,
    });

    const user = await this.userRepo.findById(userId);
    const name = (
      user?.displayName?.trim() ||
      user?.username?.trim() ||
      `user-${userId.slice(0, 8)}`
    ).slice(0, 64);

    // TTL pendek: homelab flaky + token bocor lebih cepat basi.
    const token = await mintLivekitAccessToken({
      identity: userId,
      name,
      room,
      apiKey,
      apiSecret,
      deviceId: trimmedDevice,
      ttlSec: 30 * 60,
    });

    return {
      token,
      url,
      room,
      maxParticipants: VOICE_ROOM_MAX_PARTICIPANTS,
    };
  }
}
