import { BadRequestError } from '@/shared/errors/app-error';
import {
  isVoiceRoomEventKind,
  type VoiceRoomEventKind,
} from '../domain/voice-room-event';
import type { VoiceRoomEventsRepository } from '../infrastructure/voice-room-events.repository';

const MAX_DETAIL = 240;
const MAX_ROOM = 80;
const MAX_CODE = 64;
const MAX_PLATFORM = 32;

export type RecordVoiceRoomEventInput = {
  userId: string;
  kind: string;
  room?: string | null;
  errorCode?: string | null;
  detail?: string | null;
  platform?: string | null;
};

function clip(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

export class RecordVoiceRoomEventUseCase {
  constructor(private readonly events: VoiceRoomEventsRepository) {}

  async execute(input: RecordVoiceRoomEventInput): Promise<{ kind: VoiceRoomEventKind }> {
    if (!isVoiceRoomEventKind(input.kind)) {
      throw new BadRequestError('Kind event voice tidak dikenal');
    }

    const room = clip(input.room, MAX_ROOM) ?? 'sambasku-global';

    await this.events.insert({
      userId: input.userId,
      kind: input.kind,
      room,
      errorCode: clip(input.errorCode, MAX_CODE),
      detail: clip(input.detail, MAX_DETAIL),
      platform: clip(input.platform, MAX_PLATFORM),
    });

    return { kind: input.kind };
  }
}
