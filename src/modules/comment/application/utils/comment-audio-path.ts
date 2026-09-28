import { generateId } from '@/shared/utils/ulid';
import { extensionForMime } from '@/modules/word/application/utils/pronunciation-audio-path';

/**
 * Path immutable per komentar suara:
 * assets/audio/comments/<wordId>/<ulid>.<ext>
 */
export function buildCommentAudioPath(input: {
  wordId: string;
  mimeType: string;
  id?: string;
}): string {
  const ext = extensionForMime(input.mimeType);
  if (!ext) {
    throw new Error(`MIME tidak punya ekstensi: ${input.mimeType}`);
  }
  const wordId = input.wordId.replace(/[^a-zA-Z0-9_-]/g, '');
  const id = input.id ?? generateId();
  return `assets/audio/comments/${wordId || 'unknown'}/${id}.${ext}`;
}
