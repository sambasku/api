-- Extend chat_messages.kind untuk log system (voice join/leave).
alter table public.chat_messages drop constraint if exists chat_messages_kind_chk;
alter table public.chat_messages
  add constraint chat_messages_kind_chk
  check (kind in ('text', 'sticker', 'voice_note', 'system'));
