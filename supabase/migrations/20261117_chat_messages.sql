-- Chat publik cermin realtime (Postgres Supabase). Histori penuh di Turso.
-- Apply: SQL Editor staging lalu production (BELUM di-Run sampai F0).
-- Acuan: docs/backlogs/CHAT_PUBLIK_VOICE.md
-- kind: text | sticker | voice_note | system
-- Catatan: audio_path / audio_sha TIDAK ada di sini (Turso-only untuk delete GitHub).

create table if not exists public.chat_messages (
  id             text primary key,
  channel        text not null default 'public',
  user_id        text not null,
  username       text,
  display_name   text,
  avatar_url     text,
  kind           text not null default 'text',
  body           text,
  sticker_id     text,
  audio_url      text,
  duration_ms    integer,
  reply_to_id    text,
  reply_snippet  text,
  reply_username text,
  edited_at      timestamptz,
  deleted_at     timestamptz,
  deleted_by     text,
  created_at     timestamptz not null default now(),
  constraint chat_messages_kind_chk
    check (kind in ('text', 'sticker', 'voice_note', 'system'))
);

create index if not exists chat_messages_channel_created_id
  on public.chat_messages (channel, created_at desc, id desc);

create index if not exists chat_messages_reply_to_id
  on public.chat_messages (reply_to_id);

alter table public.chat_messages enable row level security;

drop policy if exists chat_messages_select_public on public.chat_messages;
create policy chat_messages_select_public
  on public.chat_messages for select
  to anon, authenticated
  using (true);

do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception
  when duplicate_object then null;
end $$;
