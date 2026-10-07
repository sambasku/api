/**
 * Kind resmi event aktivitas publik (write-through `activity_events`).
 *
 * Sumber kebenaran daftar event: AGENTS.md #25 + .cursor/rules/activity-events-public.mdc.
 * Tambah kind = update daftar itu + docs/api/37 + docs/mobile/23 di sesi yang sama.
 *
 * Mapping ke kind wire feed lama (`GET /api/v1/activity`): satu event kind bisa
 * tayang dengan kind wire lama supaya mobile tidak breaking (lihat `wireKind`).
 */
export const ACTIVITY_EVENT_KINDS = [
  'word_created',
  'word_verified',
  'contribution_image',
  'contribution_audio',
  'contribution_pron',
  'contribution_example',
  'comment_created',
  'vote_word',
  'vote_comment',
  'discussion_created',
  'suggestion_applied',
  'suggestion_selfapply',
  'suggestion_created',
  'contribution_submitted',
  'search_miss',
  'user_joined',
  'card_shared',
] as const;

export type ActivityEventKind = (typeof ACTIVITY_EVENT_KINDS)[number];

/** Kind wire feed lama (kontrak `GET /api/v1/activity` tidak berubah). */
export function wireKind(kind: ActivityEventKind): string {
  switch (kind) {
    case 'word_created':
      return 'word';
    case 'word_verified':
    case 'suggestion_selfapply':
      return 'verification';
    case 'contribution_image':
      return 'word_image';
    case 'contribution_audio':
      return 'word_audio';
    case 'contribution_pron':
      return 'pronunciation';
    case 'contribution_example':
      return 'example';
    case 'comment_created':
      return 'comment';
    case 'vote_word':
      return 'vote';
    case 'vote_comment':
      return 'vote';
    case 'discussion_created':
      return 'discussion';
    case 'suggestion_applied':
      return 'suggestion';
    case 'suggestion_created':
      return 'suggestion';
    case 'contribution_submitted':
      return 'contribution';
    case 'search_miss':
      return 'search_miss';
    case 'user_joined':
      return 'welcome';
    case 'card_shared':
      return 'card_share';
  }
}

/** Baris `activity_events` mentah. */
export interface ActivityEventRow {
  id: string;
  kind: ActivityEventKind;
  actorId: string | null;
  targetWordId: string | null;
  targetId: string | null;
  occurredAt: Date;
  hiddenAt: Date | null;
  dedupeKey: string | null;
}

/** Input append; `occurredAt` default now, diisi eksplisit saat backfill. */
export interface AppendActivityEventInput {
  kind: ActivityEventKind;
  actorId?: string | null;
  targetWordId?: string | null;
  targetId?: string | null;
  occurredAt?: Date;
  /** Idempotensi caller; insert bentrok = event lama dipakai (upsert hidden). */
  dedupeKey?: string | null;
  /** Copy feed beku pada momen kejadian (mis. `"apam" sudah pas`); optional. */
  payload?: string | null;
  /** true = event dengan dedupeKey sama disembunyikan (mis. miss ditarik). */
  hidden?: boolean;
  /**
   * #56: nama tampilan pengusul utk kind word_verified (copy beku
   * "Memverifikasi usulan {name}: ..."). Ambil dari row yang sudah di-load
   * caller - tanpa query ekstra.
   */
  proposedByName?: string | null;
}
