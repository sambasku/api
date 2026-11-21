# Migrasi Supabase (Postgres) - cermin realtime chat

**SoT histori = Turso** (`chat_messages` via Drizzle). Tabel di sini
hanya cermin untuk Realtime / PostgREST. Jangan andalkan Supabase
sebagai satu-satunya salinan.

Terpisah dari Drizzle. File di `migrations/` di-apply manual ke
project Supabase (SQL Editor atau CLI), staging dulu lalu production.

## Staging

Project: `https://wkhlcrxlncflcztptrmg.supabase.co`  
Buka SQL Editor → paste isi `migrations/20261117_chat_messages.sql` → Run.

## Production

Project: `https://qqlksojwaqrydxhqpyqd.supabase.co`  
SQL yang sama setelah staging OK.

## Verifikasi

```bash
# SELECT anon harus OK (pakai anon/publishable key)
# INSERT dengan anon harus ditolak (RLS)
```

Realtime: pastikan tabel `chat_messages` ada di publication
`supabase_realtime` (migration sudah mencoba `alter publication …`).
