import { extensionForMime } from '@/modules/word/application/utils/pronunciation-audio-path';
import { generateId } from '@/shared/utils/ulid';

/**
 * Path immutable per voice note chat:
 * assets/audio/chat/<messageId>.<ext>
 */
export function buildChatVoiceNotePath(input: {
  messageId: string;
  mimeType: string;
}): string {
  const ext = extensionForMime(input.mimeType);
  if (!ext) {
    throw new Error(`MIME tidak punya ekstensi: ${input.mimeType}`);
  }
  const messageId = input.messageId.replace(/[^a-zA-Z0-9_-]/g, '') || generateId();
  return `assets/audio/chat/${messageId}.${ext}`;
}
