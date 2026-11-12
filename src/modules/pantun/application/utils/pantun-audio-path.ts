import { generateId } from '@/shared/utils/ulid';
import { extensionForMime } from '@/modules/word/application/utils/pronunciation-audio-path';

/**
 * Path immutable per bacaan pantun:
 * assets/audio/pantuns/<pantunId>/<ulid>.<ext>
 * Untuk create atomik, pantunId = id yang akan dipakai row (generate dulu).
 */
export function buildPantunAudioPath(input: {
  pantunId: string;
  mimeType: string;
  id?: string;
}): string {
  const ext = extensionForMime(input.mimeType);
  if (!ext) {
    throw new Error(`MIME tidak punya ekstensi: ${input.mimeType}`);
  }
  const pantunId = input.pantunId.replace(/[^a-zA-Z0-9_-]/g, '');
  const id = input.id ?? generateId();
  return `assets/audio/pantuns/${pantunId || 'unknown'}/${id}.${ext}`;
}

/**
 * Path balasan: assets/audio/pantuns/<parentId>/replies/<ulid>.<ext>
 */
export function buildPantunReplyAudioPath(input: {
  parentId: string;
  mimeType: string;
  id?: string;
}): string {
  const ext = extensionForMime(input.mimeType);
  if (!ext) {
    throw new Error(`MIME tidak punya ekstensi: ${input.mimeType}`);
  }
  const parentId = input.parentId.replace(/[^a-zA-Z0-9_-]/g, '');
  const id = input.id ?? generateId();
  return `assets/audio/pantuns/${parentId || 'unknown'}/replies/${id}.${ext}`;
}
