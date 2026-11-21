import type { AppDatabase } from '@/shared/database/drizzle/client';
import { voiceRoomEvents } from '@/shared/database/drizzle/schema/voice-room-events.schema';
import type { VoiceRoomEventKind } from '../domain/voice-room-event';

export type InsertVoiceRoomEventInput = {
  userId: string;
  kind: VoiceRoomEventKind;
  room: string;
  errorCode?: string | null;
  detail?: string | null;
  platform?: string | null;
};

/** Analitik internal - insert saja, tanpa baca feed. */
export class VoiceRoomEventsRepository {
  constructor(private readonly db: AppDatabase) {}

  async insert(input: InsertVoiceRoomEventInput): Promise<void> {
    await this.db.insert(voiceRoomEvents).values({
      userId: input.userId,
      kind: input.kind,
      room: input.room,
      errorCode: input.errorCode ?? null,
      detail: input.detail ?? null,
      platform: input.platform ?? null,
    });
  }
}
