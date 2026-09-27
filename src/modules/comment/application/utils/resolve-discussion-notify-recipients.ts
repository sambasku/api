import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import { CSV_IMPORTER_USER_ID } from '@/shared/constants/csv-importer';

export interface ResolveDiscussionNotifyRecipientsInput {
  /** Penulis komentar / aksi baru - tidak menerima notifikasi. */
  actorId: string;
  /** Pemilik entitas diskusi (mis. words.created_by); null/undefined diabaikan. */
  ownerUserId?: string | null;
  /** User yang sudah terlibat di diskusi (komentator sebelumnya, dll.). */
  priorParticipantIds: readonly string[];
}

const SYSTEM_USER_IDS = new Set([ANONIM_USER_ID, CSV_IMPORTER_USER_ID]);

/**
 * Gabungkan peserta diskusi + pemilik, buang aktor dan user sistem.
 * Generik agar bisa dipakai ulang saat target komentar selain word.
 */
export function resolveDiscussionNotifyRecipients(
  input: ResolveDiscussionNotifyRecipientsInput,
): string[] {
  const ids = new Set<string>();
  for (const id of input.priorParticipantIds) {
    if (id) ids.add(id);
  }
  if (input.ownerUserId) ids.add(input.ownerUserId);

  ids.delete(input.actorId);
  for (const systemId of SYSTEM_USER_IDS) {
    ids.delete(systemId);
  }
  return [...ids];
}
