import { generateId } from '@/shared/utils/ulid';
import { extensionForMime } from '@/modules/word/application/utils/pronunciation-audio-path';

/**
 * Path immutable per balasan suara:
 * assets/audio/discussions/<discussionId>/<ulid>.<ext>
 */
export function buildDiscussionReplyAudioPath(input: {
  discussionId: string;
  mimeType: string;
  id?: string;
}): string {
  const ext = extensionForMime(input.mimeType);
  if (!ext) {
    throw new Error(`MIME tidak punya ekstensi: ${input.mimeType}`);
  }
  const discussionId = input.discussionId.replace(/[^a-zA-Z0-9_-]/g, '');
  const id = input.id ?? generateId();
  return `assets/audio/discussions/${discussionId || 'unknown'}/${id}.${ext}`;
}
