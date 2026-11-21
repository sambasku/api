import { env } from '@/shared/config/env';
import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';
import { VOICE_ROOM_ENABLED_KEY } from '@/modules/chat/application/use-cases/chat.use-cases';
import { listVoiceRoomParticipantCount } from '../infrastructure/livekit-room-service';

export interface VoiceRoomSummary {
  room: string;
  participantCount: number;
  voiceRoomEnabled: boolean;
}

export class GetVoiceRoomSummaryUseCase {
  constructor(private readonly settingsRepo: AppSettingsRepository) {}

  async execute(): Promise<VoiceRoomSummary> {
    const rows = await this.settingsRepo.getByKeys([VOICE_ROOM_ENABLED_KEY]);
    const raw = rows.find((r) => r.key === VOICE_ROOM_ENABLED_KEY)?.value;
    const voiceRoomEnabled = raw === 'true';
    const room = (env.LIVEKIT_ROOM_NAME?.trim() || 'sambasku-global').trim();

    if (!voiceRoomEnabled) {
      return { room, participantCount: 0, voiceRoomEnabled: false };
    }

    const url = env.LIVEKIT_URL?.trim();
    const apiKey = env.LIVEKIT_API_KEY?.trim();
    const apiSecret = env.LIVEKIT_API_SECRET?.trim();
    if (!url || !apiKey || !apiSecret) {
      return { room, participantCount: 0, voiceRoomEnabled: true };
    }

    try {
      const participantCount = await listVoiceRoomParticipantCount({
        wsUrl: url,
        apiKey,
        apiSecret,
        room,
      });
      return { room, participantCount, voiceRoomEnabled: true };
    } catch {
      return { room, participantCount: 0, voiceRoomEnabled: true };
    }
  }
}