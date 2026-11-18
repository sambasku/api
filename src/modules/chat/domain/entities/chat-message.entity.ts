/** Channel tunggal v1 (IRC-like). */
export const CHAT_CHANNEL_PUBLIC = 'public' as const;

export type ChatChannel = typeof CHAT_CHANNEL_PUBLIC;

/** F1a: text | sticker. voice_note = F1b. */
export type ChatMessageKind = 'text' | 'sticker' | 'voice_note';

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
  const raw = (parent.body ?? '').trim().replace(/\s+/g, ' ');
  if (!raw) return 'Pesan dihapus';
  if (raw.length <= 80) return raw;
  return `${raw.slice(0, 79).trimEnd()}...`;
}
