import type { Context } from 'hono';
import { UnauthorizedError } from '@/shared/errors/app-error';
import type { AppVariables } from '@/shared/types';
import type { MintVoiceTokenUseCase } from '../../application/mint-voice-token.use-case';
import type { MintTurnCredentialsUseCase } from '../../application/mint-turn-credentials.use-case';
import type { RecordVoiceRoomEventUseCase } from '../../application/record-voice-room-event.use-case';
import type { GetVoiceRoomSummaryUseCase } from '../../application/get-voice-room-summary.use-case';

export class VoiceController {
  constructor(
    private readonly mintToken: MintVoiceTokenUseCase,
    private readonly recordEvent: RecordVoiceRoomEventUseCase,
    private readonly mintTurnCreds: MintTurnCredentialsUseCase,
    private readonly roomSummary: GetVoiceRoomSummaryUseCase,
  ) {}

  /** Jumlah peserta voice room untuk pengamat chat (tanpa join LiveKit). */
  summary(c: Context<{ Variables: AppVariables }>) {
    return this.roomSummary.execute().then((data) =>
      c.json(
        {
          success: true as const,
          data: {
            room: data.room,
            participant_count: data.participantCount,
            voice_room_enabled: data.voiceRoomEnabled,
          },
        },
        200,
      ),
    );
  }

  mint(c: Context<{ Variables: AppVariables }>) {
    const user = c.get('user');
    if (!user?.user_id) {
      throw new UnauthorizedError();
    }
    // Header yang sudah disisip interceptor mobile (rate-limit device id).
    const deviceId =
      c.req.header('X-Device-Id')?.trim() ||
      c.req.header('x-device-id')?.trim() ||
      '';
    return this.mintToken
      .execute(user.user_id, deviceId)
      .then((data) => c.json({ success: true as const, data }, 200));
  }

  /** Kredensial coturn time-limited untuk ICE relay. */
  turnCreds(c: Context<{ Variables: AppVariables }>) {
    const user = c.get('user');
    if (!user?.user_id) {
      throw new UnauthorizedError();
    }
    return this.mintTurnCreds
      .execute()
      .then((data) => c.json({ success: true as const, data }, 200));
  }

  /** Analitik internal join/leave - bukan feed. */
  event(c: Context<{ Variables: AppVariables }>) {
    const user = c.get('user');
    if (!user?.user_id) {
      throw new UnauthorizedError();
    }
    const body = c.req.valid('json' as never) as {
      kind: string;
      room?: string;
      errorCode?: string;
      detail?: string;
      platform?: string;
    };
    return this.recordEvent
      .execute({
        userId: user.user_id,
        kind: body.kind,
        room: body.room,
        errorCode: body.errorCode,
        detail: body.detail,
        platform: body.platform,
      })
      .then((data) => c.json({ success: true as const, data }, 200));
  }
}
