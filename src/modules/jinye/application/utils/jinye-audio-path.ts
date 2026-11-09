import { generateId } from '@/shared/utils/ulid';
import { extensionForMime } from '@/modules/word/application/utils/pronunciation-audio-path';

/**
 * Path immutable voice note Jinye:
 * assets/audio/jinye/<jinyeId>/<ulid>.<ext>
 */
export function buildJinyeAudioPath(input: {
  jinyeId: string;
  mimeType: string;
  id?: string;
}): string {
  const ext = extensionForMime(input.mimeType);
  if (!ext) {
    throw new Error(`MIME tidak punya ekstensi: ${input.mimeType}`);
  }
  const jinyeId = input.jinyeId.replace(/[^a-zA-Z0-9_-]/g, '');
  const id = input.id ?? generateId();
  return `assets/audio/jinye/${jinyeId || 'unknown'}/${id}.${ext}`;
}
