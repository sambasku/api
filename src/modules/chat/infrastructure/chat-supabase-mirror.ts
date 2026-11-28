import { env } from '@/shared/config/env';
import { logger } from '@/shared/logging/logger';
import type { ChatMessage } from '../domain/entities/chat-message.entity';

/** Payload mirror Supabase - tanpa audio_path / audio_sha. */
export interface ChatMirrorPayload {
  id: string;
  channel: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  kind: string;
  body: string | null;
  sticker_id: string | null;
  audio_url: string | null;
  duration_ms: number | null;
  reply_to_id: string | null;
  reply_snippet: string | null;
  reply_username: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
}

export function toMirrorPayload(msg: ChatMessage): ChatMirrorPayload {
  return {
    id: msg.id,
    channel: msg.channel,
    user_id: msg.userId,
    username: msg.username,
    display_name: msg.displayName,
    avatar_url: msg.avatarUrl,
    kind: msg.kind,
    body: msg.body,
    sticker_id: msg.stickerId,
    audio_url: msg.audioUrl,
    duration_ms: msg.durationMs,
    reply_to_id: msg.replyToId,
    reply_snippet: msg.replySnippet,
    reply_username: msg.replyUsername,
    edited_at: msg.editedAt?.toISOString() ?? null,
    deleted_at: msg.deletedAt?.toISOString() ?? null,
    deleted_by: msg.deletedBy,
    created_at: msg.createdAt.toISOString(),
  };
}

export interface ChatSupabaseMirror {
  upsert(message: ChatMessage): Promise<void>;
  patch(message: ChatMessage): Promise<void>;
  /** Setelah tombstone: kutipan balasan yang memuat teks asli ikut ditutup. */
  patchReplySnippets(messageId: string, snippet: string): Promise<void>;
}

let skipLogged = false;

function mirrorConfig(): { base: string; key: string } | null {
  const base = env.SUPABASE_URL?.replace(/\/$/, '');
  const key = env.SUPABASE_SECRET_KEY;
  if (!base || !key) {
    if (!skipLogged) {
      skipLogged = true;
      logger.warn(
        { hasUrl: Boolean(base), hasKey: Boolean(key) },
        'chat supabase mirror skipped: SUPABASE_URL / SUPABASE_SECRET_KEY missing',
      );
    }
    return null;
  }
  return { base, key };
}

async function postgrest(
  method: 'POST' | 'PATCH',
  pathAndQuery: string,
  body: unknown,
  prefer: string,
): Promise<void> {
  const cfg = mirrorConfig();
  if (!cfg) return;

  const url = `${cfg.base}/rest/v1/${pathAndQuery}`;
  try {
    const res = await fetch(url, {
      method,
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        'Content-Type': 'application/json',
        Prefer: prefer,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.warn(
        { status: res.status, body: text.slice(0, 300), method, pathAndQuery },
        'chat supabase mirror failed',
      );
    }
  } catch (err) {
    logger.warn({ err, method, pathAndQuery }, 'chat supabase mirror error');
  }
}

export class ChatSupabaseMirrorService implements ChatSupabaseMirror {
  async upsert(message: ChatMessage): Promise<void> {
    await postgrest(
      'POST',
      'chat_messages?on_conflict=id',
      toMirrorPayload(message),
      'resolution=merge-duplicates,return=minimal',
    );
  }

  async patch(message: ChatMessage): Promise<void> {
    const payload = toMirrorPayload(message);
    // Jangan timpa created_at saat edit/tombstone.
    const { created_at: _c, id: _id, ...patch } = payload;
    await postgrest(
      'PATCH',
      `chat_messages?id=eq.${encodeURIComponent(message.id)}`,
      patch,
      'return=minimal',
    );
  }

  async patchReplySnippets(messageId: string, snippet: string): Promise<void> {
    await postgrest(
      'PATCH',
      `chat_messages?reply_to_id=eq.${encodeURIComponent(messageId)}`,
      { reply_snippet: snippet },
      'return=minimal',
    );
  }
}
