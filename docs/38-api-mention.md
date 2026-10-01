# 38. API Mention (@username)

## Ringkasan

Fitur mention `@username` di komentar kosakata dan balasan diskusi. User yang di-mention menerima notifikasi inbox tipe khusus (`word_comment_mention` / `discussion_mention`) dan push FCM **tanpa cooldown** (keputusan desain: mention = panggilan langsung, harus selalu sampai).

Implementasi: parser regex `@([a-zA-Z0-9_.-]{3,30})` di backend, endpoint suggest publik untuk autocomplete, integrasi notifikasi mention di `create-comment` dan `create-discussion-reply`.

## Endpoint Suggest Username (Autocomplete)

### GET /api/v1/users/suggest

Saran username untuk autocomplete mention. **Publik** (tanpa auth), hanya kolom aman (tanpa PII).

**Query Parameters:**
- `q` (string, required): prefix username, minimal 2 karakter, maksimal 30 karakter

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "01J9...",
        "username": "budi",
        "display_name": "Budi Santoso",
        "avatar_url": "https://img.sambasku.id/avatar/01J9.webp"
      }
    ]
  }
}
```

**Response 400:** query kurang dari 2 karakter.

**Implementasi:**
- Drizzle: `users.username like 'prefix%' escape '\\'`, `isNull(deletedAt)`, `eq(isActive, true)`, order by username, limit 10.
- Tanpa kredensial PII (email/phone/hash).

## Notifikasi Mention

### Tipe Notifikasi Baru

Ditambahkan ke union `InboxNotificationType`:
- `word_comment_mention`: "Kamu disebut di komentar" - mention di komentar kosakata
- `discussion_mention`: "Kamu disebut di diskusi" - mention di balasan diskusi

### Copy Notifikasi

**Inbox (word_comment_mention):**
- Title: `Kamu disebut di komentar`
- Body: `{actorName} menyebutmu di komentar "{lemma}": {snippet}`
- Target: `word`, `targetId` = word ID
- Action: `word`, `actionValue` = word ID

**Inbox (discussion_mention):**
- Title: `Kamu disebut di diskusi`
- Body: `{actorName} menyebutmu di diskusi "{topicLabel}": {snippet}`
- Target: `discussion`, `targetId` = discussion ID
- Action: `discussion`, `actionValue` = discussion ID

**Push FCM:**
- Data payload sama dengan inbox.
- **TANPA cooldown**: mention tidak lewat `WordCommentPushCooldownGate` / `DiscussionReplyPushCooldownGate`. Keputusan desain: mention = sinyal kuat, tidak boleh tertunda atau tertimpa.

### Perilaku Inbox

- `refreshOnConflict = false`: mention **tidak menimpa** notifikasi komentar/balasan biasa. Tiap mention adalah baris inbox terpisah.
- Mention ke diri sendiri di-skip (aktor tidak self-notify).
- Mention ke user yang di-block/mute oleh target: body mention sudah lolos blocklist (disaring sebagai teks biasa), jadi terkirim. User bisa mute/block aktor setelah menerima.

## Extract Mentions (Backend)

**Parser:** `@([a-zA-Z0-9_.-]{3,30})`
- Capture username 3-30 karakter (batasan username SambasKu).
- Dedupe via Set (mention ganda hanya kirim sekali).
- Filter: `anonim` (system user).

**Resolusi:**
- `findMentionableUsers`: lookup batch per username via `UserRepository.findByUsername`.
- Filter `isActive && !deletedAt`.
- Return hanya kolom publik: `id`, `username`, `displayName`, `avatarUrl` (tanpa email/phone/hash).

## Integrasi Use Case

### CreateCommentUseCase

Setelah `notifyDiscussionParticipants`, panggil `notifyMentionedUsers`:
1. Extract `@username` dari `comment.body`.
2. Resolve ke user aktif.
3. Skip aktor sendiri.
4. Kirim inbox `word_comment_mention` + push FCM (tanpa cooldown).

### CreateDiscussionReplyUseCase

Setelah `notifyThreadParticipants`, panggil `notifyMentionedUsers`:
1. Extract `@username` dari `reply.body`.
2. Resolve ke user aktif.
3. Skip aktor sendiri.
4. Kirim inbox `discussion_mention` + push FCM (tanpa cooldown).

## Database Schema

**Tidak ada perubahan tabel.** Mention tidak disimpan sebagai relasi terpisah; hanya diproses saat create comment/reply untuk kirim notifikasi.

`docs/dbdiagram.dbml` tidak berubah.

## Testing

1. POST komentar/balasan dengan `@username` yang valid → user tersebut dapat inbox + push mention.
2. POST dengan `@anonim` → tidak kirim notifikasi (system user).
3. POST dengan `@userTidakAda` → tidak error, hanya skip (user tidak ditemukan).
4. POST dengan mention diri sendiri `@myusername` → tidak self-notify.
5. GET `/api/v1/users/suggest?q=bu` → return user yang username dimulai `bu`.
6. GET `/api/v1/users/suggest?q=x` → 400 (kurang dari 2 karakter).

## Mobile (TODO - belum diimplementasikan)

Implementasi mobile tertunda. Rencana:
- Composer komentar/balasan: deteksi `@` → fetch `/api/v1/users/suggest?q={prefix}` (debounce 300ms) → tampilkan inline suggestion → tap sisipkan username.
- Render `@username` di `ThreadMessageRow`: warna primer + tap ke profil user.
- File target: `lib/features/comment/presentation/widgets/word_comments_section.dart`, `lib/features/discussion/presentation/pages/discussion_detail_page.dart`.

## Referensi

- `docs/api/09-api-comment.md` - kontrak komentar
- `docs/api/32-api-discussions.md` - kontrak diskusi
- `docs/api/23-api-notifications.md` - tipe notifikasi
- Issue: `sambasku/mobile#64` - "Mention user on comment with username"
