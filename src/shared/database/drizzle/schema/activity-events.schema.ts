import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';

/**
 * Event log aktivitas publik (write-through). Sumber tunggal feed beranda
 * (`GET /api/v1/activity`) dan timeline profil publik. Baris dibekukan pada
 * momen kejadian: mengedit/melengkapi entitas TIDAK menulis ulang sejarah
 * (pembelajaran issue #86: `words.verified_at` tertimpa alur lengkapi kata
 * sehingga kata lama muncul sebagai "Baru ditambahkan").
 *
 * - Waktu kejadian = `occurred_at` (momen aksi), bukan timestamp kolom sumber.
 * - Visibility dicek read-time (soft-delete/takedown/label terlarang/blocklist)
 *   via `target_word_id` join; event tidak pernah dihapus fisik.
 * - `hidden_at` terisi saat event dicabut dari feed (mis. vote ditarik):
 *   bukan delete, supaya audit tetap ada dan restore mungkin.
 * - `dedupe_key` opsional mencegah event ganda dari retry/idempotensi caller.
 *
 * Kind resmi: lihat `ACTIVITY_EVENT_KINDS` di domain entities modul activity.
 */
export const activityEvents = sqliteTable(
  'activity_events',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    /** Kind resmi (snake_case), contoh: word_created, vote_word. */
    kind: text('kind').notNull(),
    /** Pelaku; null untuk event tanpa actor (search_miss). */
    actorId: text('actor_id').references(() => users.id),
    /** Kata terkait untuk visibility read-time; null bila tak menyebut kata. */
    targetWordId: text('target_word_id'),
    /** Id entitas target (comment id, discussion id, miss id, dll). */
    targetId: text('target_id'),
    /** Nama tampilan event untuk payload feed (tanpa lemma; lemma diresolve read-time). */
    occurredAt: integer('occurred_at', { mode: 'timestamp' }).notNull(),
    /** Terisi = tidak tayang di feed (vote ditarik, dsb). Bukan delete. */
    hiddenAt: integer('hidden_at', { mode: 'timestamp' }),
    /** Idempotensi caller (mis. `card_share:{userId}:{wordId}:{yyyy-mm-dd}`). */
    dedupeKey: text('dedupe_key'),
    /**
     * Copy feed beku pada momen kejadian (mis. `"apam" sudah pas`).
     * Null = pakai fallback `bodyFor()` read-time (event lama/backfill).
     */
    payload: text('payload'),
    /**
     * #56: terisi = cerita event ini sudah digantikan event lanjutan utk kata
     * yang sama (usulan → verifikasi). Feed home menyaringnya; profil tetap
     * memuat (riwayat kontributor). Bukan hidden/delete - audit tetap.
     */
    supersededAt: integer('superseded_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('activity_events_feed_idx').on(t.occurredAt, t.id),
    index('activity_events_actor_idx').on(t.actorId, t.occurredAt, t.id),
    index('activity_events_word_idx').on(t.targetWordId),
    uniqueIndex('activity_events_dedupe_idx').on(t.dedupeKey),
  ],
);
