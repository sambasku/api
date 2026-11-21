/** Channel tunggal v1 (IRC-like). */
export const CHAT_CHANNEL_PUBLIC = 'public' as const;

export type ChatChannel = typeof CHAT_CHANNEL_PUBLIC;

/** text | sticker | voice_note | system (log voice join/leave + ping). */
export type ChatMessageKind = 'text' | 'sticker' | 'voice_note' | 'system';

/** Body system untuk jejak ping (render: `{displayName} PING!!!`). */
export const CHAT_PING_BODY = 'PING!!!';
/** Cooldown global antar ping di channel public (detik). */
export const CHAT_PING_COOLDOWN_SECONDS = 300;

/** Panjang maks isi pesan teks chat (create/edit). */
export const CHAT_BODY_MAX = 240;

/** Baris chat_messages (SoT Turso). audio_path/sha tidak pernah ke wire. */
export interface ChatMessage {
  id: string;
  channel: string;
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  kind: ChatMessageKind;
  body: string | null;
  stickerId: string | null;
  audioUrl: string | null;
  /** Turso-only - jangan expose di wire / mirror. */
  audioPath: string | null;
  /** Turso-only - jangan expose di wire / mirror. */
  audioSha: string | null;
  durationMs: number | null;
  replyToId: string | null;
  replySnippet: string | null;
  replyUsername: string | null;
  editedAt: Date | null;
  deletedAt: Date | null;
  deletedBy: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface ChatMessageRevision {
  id: string;
  messageId: string;
  editorId: string;
  body: string;
  createdAt: Date;
}

/** Cuplikan reply untuk pita di atas bubble. */
export function buildReplySnippet(parent: ChatMessage): string {
  if (parent.deletedAt) return 'Pesan dihapus';
  if (parent.kind === 'sticker') return '[stiker]';
  if (parent.kind === 'voice_note') return '[voice note]';
  if (parent.kind === 'system') return '[sistem]';
  const raw = (parent.body ?? '').trim().replace(/\s+/g, ' ');
  if (!raw) return 'Pesan dihapus';
  if (raw.length <= 80) return raw;
  return `${raw.slice(0, 79).trimEnd()}...`;
}
