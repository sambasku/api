import { BadRequestError } from '@/shared/errors/app-error';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import {
  CHAT_CHANNEL_PUBLIC,
} from '@/modules/chat/domain/entities/chat-message.entity';
import type { ChatRepository } from '@/modules/chat/domain/repositories/chat.repository';
import type { ChatSupabaseMirror } from '@/modules/chat/infrastructure/chat-supabase-mirror';
import {
  isVoiceRoomEventKind,
  type VoiceRoomEventKind,
} from '../domain/voice-room-event';
import type { VoiceRoomEventsRepository } from '../infrastructure/voice-room-events.repository';

const MAX_DETAIL = 240;
const MAX_ROOM = 80;
const MAX_CODE = 64;
const MAX_PLATFORM = 32;

/** Body aksi saja - nama diambil dari denorm user di row chat. */
const VOICE_PRESENCE_BODY: Record<'joined' | 'left', string> = {
  joined: 'bergabung ke voice room',
  left: 'keluar dari voice room',
};

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
  constructor(
    private readonly events: VoiceRoomEventsRepository,
    private readonly chatRepo?: ChatRepository,
    private readonly chatMirror?: ChatSupabaseMirror,
    private readonly userRepo?: UserRepository,
  ) {}

  async execute(
    input: RecordVoiceRoomEventInput,
  ): Promise<{ kind: VoiceRoomEventKind }> {
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

    if (input.kind === 'joined' || input.kind === 'left') {
      await this._mirrorPresenceToChat(input.userId, input.kind);
    }

    return { kind: input.kind };
  }

  private async _mirrorPresenceToChat(
    userId: string,
    kind: 'joined' | 'left',
  ): Promise<void> {
    if (!this.chatRepo || !this.chatMirror || !this.userRepo) return;

    try {
      const user = await this.userRepo.findById(userId);
      if (!user) return;

      const created = await this.chatRepo.create({
        channel: CHAT_CHANNEL_PUBLIC,
        userId,
        username: user.username,
        displayName: user.displayName || user.username,
        avatarUrl: user.avatarUrl ?? null,
        kind: 'system',
        body: VOICE_PRESENCE_BODY[kind],
        stickerId: null,
        replyToId: null,
        replySnippet: null,
        replyUsername: null,
      });

      await this.chatMirror.upsert(created);
    } catch {
      // Analitik sudah tersimpan - jangan gagalkan event voice.
    }
  }
}
