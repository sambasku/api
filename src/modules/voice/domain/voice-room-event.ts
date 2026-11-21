export const VOICE_ROOM_EVENT_KINDS = [
  'joined',
  'left',
  'disconnect',
  'join_failed',
] as const;

export type VoiceRoomEventKind = (typeof VOICE_ROOM_EVENT_KINDS)[number];

export function isVoiceRoomEventKind(value: string): value is VoiceRoomEventKind {
  return (VOICE_ROOM_EVENT_KINDS as readonly string[]).includes(value);
}
