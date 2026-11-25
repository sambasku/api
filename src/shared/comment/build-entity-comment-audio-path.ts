import { generateId } from '@/shared/utils/ulid';
import { extensionForMime } from '@/modules/word/application/utils/pronunciation-audio-path';

export type EntityCommentAudioKind = 'places' | 'usaha' | 'cuisine' | 'events' | 'articles' | 'karya';

/**
 * Path immutable per komentar suara entitas:
 * assets/audio/comments/<kind>/<parentId>/<ulid>.<ext>
 */
export function buildEntityCommentAudioPath(input: {
  kind: EntityCommentAudioKind;
  parentId: string;
  mimeType: string;
  id?: string;
}): string {
  const ext = extensionForMime(input.mimeType);
  if (!ext) {
    throw new Error(`MIME tidak punya ekstensi: ${input.mimeType}`);
  }
  const parent = input.parentId.replace(/[^a-zA-Z0-9_-]/g, '');
  const id = input.id ?? generateId();
  return `assets/audio/comments/${input.kind}/${parent || 'unknown'}/${id}.${ext}`;
}