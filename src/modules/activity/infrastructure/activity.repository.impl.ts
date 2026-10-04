import { and, desc, eq, gt, inArray, isNotNull, isNull, ne, or, sql, type SQL } from 'drizzle-orm';
import type { AnyColumn } from 'drizzle-orm';
import {
  comments,
  contributions,
  discussions,
  examples,
  meanings,
  pronunciations,
  searchMisses,
  searchMissSearchers,
  users,
  votes,
  wordAudios,
  wordCardShares,
  wordEditSuggestions,
  wordImages,
  words,
} from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import { FEED_EXCLUDED_USAGE_LABELS } from '@/shared/constants/usage-labels';
import {
  publicAccountDisplayName,
  publicAccountName,
} from '@/shared/constants/deleted-account';
import type { ActivityItem, ActivityKind } from '../domain/entities/activity-item.entity';
import type { ActivityCursor } from '../domain/merge-activity';
import type { ActivityRepository } from '../domain/repositories/activity.repository';

/**
 * Keyset DESC: baris lebih lama dari cursor.
 * Kind cocok → (time, id) < cursor; kind beda → time < cursor saja.
 */
function keysetBefore(
  timeExpr: SQL | AnyColumn,
  idColumn: AnyColumn,
  before: ActivityCursor | undefined,
  kindOrKinds: string | string[],
): SQL | undefined {
  if (!before) return undefined;
  const colon = before.id.indexOf(':');
  const kind = colon >= 0 ? before.id.slice(0, colon) : '';
  const entityId = colon >= 0 ? before.id.slice(colon + 1) : before.id;
  const kinds = Array.isArray(kindOrKinds) ? kindOrKinds : [kindOrKinds];
  // WAJIB konversi ke epoch SECONDS: `timeExpr` dibandingkan dalam detik, tapi
  // `sql` mentah ter-bind `Date` sebagai MILLISECONDS. Kalau tidak, `ts < ms`
  // selalu benar -> halaman 2 mengulang baris halaman 1 (infinite scroll).
  const beforeSeconds = Math.floor(before.createdAt.getTime() / 1000);
  if (kinds.includes(kind) && entityId.length > 0) {
    return sql`(${timeExpr}, ${idColumn}) < (${beforeSeconds}, ${entityId})`;
  }
  return sql`${timeExpr} < ${beforeSeconds}`;
}

/**
 * Batas atas timestamp yang masih waras. Kolom `mode: 'timestamp'` di Drizzle
 * menyimpan epoch SECONDS, jadi 1e10 = tahun 2286 - jauh di atas horizon data
 * mana pun. Nilai di atas itu berarti ada yang menulis epoch MILLISECONDS
 * (#47): `ORDER BY` mengikat baris itu di puncak feed, keyset ikut condong, dan
 * klien merender diff negatif "baru".
 *
 * Sengaja lebih ketat dari trigger migrasi `0049_timestamp-unit-repair` (1e11):
 * trigger hanya menyaring penulisan, batas feed tidak boleh ikut bergeser
 * diam-diam. Selisih keduanya justru dipakai test untuk membuktikan guard feed
 * bekerja sendiri, bukan cuma trigger.
 */
const MAX_PLAUSIBLE_TS_S = 10_000_000_000;

/** Kolom tanggal, atau NULL kalau nilainya di luar rentang yang masuk akal. */
function saneTs(column: SQL | AnyColumn): SQL<number> {
  return sql`case when ${column} is not null and ${column} < ${MAX_PLAUSIBLE_TS_S} then ${column} end`;
}

/**
 * "Waktu aksi" sebuah baris untuk feed: kolom pertama yang bernilai waras.
 * Dipakai SERENTAK untuk `ORDER BY` dan keyset supaya keduanya tidak pernah
 * berbeda — kalau beda, halaman berikutnya melompati atau mengulang baris.
 * NULL berarti semua kolom timestamp-nya rusak; pemanggil wajib memfilter.
 *
 * Hasinya epoch SECONDS (satuan kolomnya), jadi wajib lewat [secondsToDate].
 */
function occurredAtSql(...columns: Array<SQL | AnyColumn>): SQL<number> {
  if (columns.length === 1) return saneTs(columns[0]!);
  return sql`coalesce(${sql.join(columns.map(saneTs), sql`, `)})`;
}

/**
 * Ekspresi `mode: 'timestamp'` tidak ikut di-decode Drizzle saat di-select
 * sebagai `SQL` mentah, jadi nilainya masih epoch SECONDS.
 */
function secondsToDate(seconds: number | null): Date {
  return new Date((seconds ?? 0) * 1000);
}

const WORD_BOUND_VOTE_TYPES = new Set(['word', 'comment']);

const CONTRIB_BODY: Record<string, string> = {
  word_image: 'Menambah foto',
  word_audio: 'Merekam suara',
  pronunciation: 'Menambah cara baca',
  example: 'Menambah contoh kalimat',
};

function feedSafeUsageLabelsSql() {
  return and(
    ...FEED_EXCLUDED_USAGE_LABELS.map(
      (label) => sql`${words.usageLabels} NOT LIKE ${`%"${label}"%`}`,
    ),
  );
}

/** Kata tayang yang boleh disebut di feed (bukan berlabel terlarang). */
function feedVisibleWordSql() {
  return and(isNull(words.deletedAt), eq(words.status, 'published'), feedSafeUsageLabelsSql());
}

/**
 * Buang baris milik `excludeUserId` dari sebuah sumber.
 *
 * `undefined` → tak ada penyaringan (feed publik utuh, termasuk untuk tamu).
 *
 * Kolom yang `.notNull()` aman pakai `ne` biasa. Kolom yang nullable perlu
 * `or(isNull(...))`: `NULL <> 'x'`evaluate jadi NULL, bukan true, jadi kata
 * impor sistem (`words.createdBy` null) ikut lenyap tanpa sengaja.
 */
function notSelfSql(
  column: AnyColumn,
  excludeUserId: string | undefined,
): SQL | undefined {
  if (!excludeUserId) return undefined;
  return ne(column, excludeUserId);
}

/** Sama seperti [notSelfSql], untuk kolom sumber yang boleh null. */
function notSelfOrNullSql(
  column: AnyColumn,
  excludeUserId: string | undefined,
): SQL | undefined {
  if (!excludeUserId) return undefined;
  return or(isNull(column), ne(column, excludeUserId));
}

/**
 * Buang baris yang "menyebut" karya sendiri: vote orang lain atas kata milik
 * `excludeUserId`.
 *
 * Bedanya dari [notSelfSql]: yang dicek bukan pelaku (sudah ditangani
 * `notSelfSql(votes.userId)`) tapi TARGET vote. Vote di feed hanya bermakna
 * kalau target-nya kata/komentar milik orang lain - kalau target-nya kata saya,
 * baris itu bicara tentang kata saya, bukan tentang aksi orang lain.
 *
 * Dibangun sebagai subquery EXISTS, bukan join, supaya baris yang terbuang tidak
 * memakan `limit` (alasan yang sama seperti penyaringan sumber lain: penyaringan
 * wajib di SQL, bukan setelah query).
 *
 * `entity_type` vote polymorphic dan target TANPA FK (lihat votes.schema.ts),
 * jadi setiap jenis punya resolusi sendiri. Jenis yang tidak ada di sini
 * (discussion, discussion_reply) tidak pernah menyebut kata, jadi tidak perlu.
 */
function notMyWordVoteSql(excludeUserId: string | undefined): SQL | undefined {
  if (!excludeUserId) return undefined;

  // Target vote yang-owner-nya bisa dicek ke `words.created_by`:
  // - word:          words.id
  // - comment:       comments.word_id
  // - meaning:       meanings.word_id
  // - example:       examples -> meanings -> word_id
  // - pronunciation / word_image / word_audio: word_id langsung
  const myWordVote = sql`exists (
    select 1 from ${words} w
    where w.created_by = ${excludeUserId}
      and (
        (${votes.entityType} = 'word' and w.id = ${votes.entityId})
        or (${votes.entityType} = 'comment' and w.id = (
          select c.word_id from ${comments} c where c.id = ${votes.entityId}
        ))
        or (${votes.entityType} = 'meaning' and w.id = (
          select m.word_id from ${meanings} m where m.id = ${votes.entityId}
        ))
        or (${votes.entityType} = 'example' and w.id = (
          select m2.word_id from ${examples} e
          inner join ${meanings} m2 on m2.id = e.meaning_id
          where e.id = ${votes.entityId}
        ))
        or (${votes.entityType} = 'pronunciation' and w.id = (
          select p.word_id from ${pronunciations} p where p.id = ${votes.entityId}
        ))
        or (${votes.entityType} = 'word_image' and w.id = (
          select i.word_id from ${wordImages} i where i.id = ${votes.entityId}
        ))
        or (${votes.entityType} = 'word_audio' and w.id = (
          select au.word_id from ${wordAudios} au where au.id = ${votes.entityId}
        ))
      )
  )`;

  return sql`not ${myWordVote}`;
}

/** Lemma di body feed selalu dikutip (sama seperti `Mencari "…"`); mobile menebalkannya. */
function quoted(lemma: string): string {
  return `"${lemma}"`;
}

function snippet(text: string, max = 120): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function searchMissBody(term: string): string {
  const shown = term.trim() || '…';
  return `Mencari "${shown}" - belum ada di kamus.`;
}

/** Term sama dengan lemma berlabel terlarang: jangan diiklankan di feed. */
const matchesExcludedLemmaSql = sql`exists (
  select 1 from ${words}
  where lower(${words.lemma}) = lower(${searchMisses.term})
    and ${words.deletedAt} is null
    and (${sql.join(
      FEED_EXCLUDED_USAGE_LABELS.map((label) => sql`${words.usageLabels} LIKE ${`%"${label}"%`}`),
      sql` or `,
    )})
)`;

/** Fulfilled = ada kata published dengan lemma = term (arah lemma). */
const isFulfilledLemmaSql = sql`exists (
  select 1 from ${words}
  where lower(${words.lemma}) = lower(${searchMisses.term})
    and ${words.status} = 'published'
    and ${words.deletedAt} is null
)`;

export class ActivityRepositoryImpl implements ActivityRepository {
  constructor(private readonly db: AppDatabase) {}

  async listRecentWords(
    limit: number,
    before?: ActivityCursor,
    excludeUserId?: string,
  ): Promise<ActivityItem[]> {
    const occurredAt = occurredAtSql(words.verifiedAt, words.createdAt);
    const rows = await this.db
      .select({
        id: words.id,
        lemma: words.lemma,
        occurredAt,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        authorDeletedAt: users.deletedAt,
      })
      .from(words)
      .leftJoin(users, eq(users.id, words.createdBy))
      .where(
        and(
          isNull(words.deletedAt),
          eq(words.status, 'published'),
          feedSafeUsageLabelsSql(),
          notSelfOrNullSql(words.createdBy, excludeUserId),
          isNotNull(occurredAt),
          keysetBefore(occurredAt, words.id, before, 'word'),
        ),
      )
      .orderBy(desc(occurredAt), desc(words.id))
      .limit(limit);

    const senses = await this.attachWordSenses(rows.map((r) => r.id));

    return rows.map((row) => {
      const sense = senses.get(row.id);
      const username = publicAccountName(row.username, row.authorDeletedAt);
      const displayName = publicAccountDisplayName(
        row.displayName,
        row.username,
        row.authorDeletedAt,
      );
      return {
        id: `word:${row.id}`,
        kind: 'word' as const,
        createdAt: secondsToDate(row.occurredAt),
        actor:
          username || displayName
            ? {
                username,
                displayName,
                avatarUrl: row.authorDeletedAt ? null : (row.avatarUrl ?? null),
              }
            : null,
        body: sense
          ? `${quoted(row.lemma)} · ${snippet(sense, 80)}`
          : quoted(row.lemma),
        subtitle: 'Baru ditambahkan',
        target: { type: 'word', id: row.id },
      };
    });
  }

  async listRecentComments(
    limit: number,
    before?: ActivityCursor,
    excludeUserId?: string,
  ): Promise<ActivityItem[]> {
    const occurredAt = occurredAtSql(comments.createdAt);
    const rows = await this.db
      .select({
        id: comments.id,
        body: comments.body,
        wordId: comments.wordId,
        occurredAt,
        lemma: words.lemma,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        authorDeletedAt: users.deletedAt,
      })
      .from(comments)
      .innerJoin(words, eq(comments.wordId, words.id))
      .leftJoin(users, eq(users.id, comments.userId))
      .where(
        and(
          eq(comments.status, 'published'),
          isNull(comments.deletedAt),
          feedVisibleWordSql(),
          notSelfSql(comments.userId, excludeUserId),
          isNotNull(occurredAt),
          keysetBefore(occurredAt, comments.id, before, 'comment'),
        ),
      )
      .orderBy(desc(occurredAt), desc(comments.id))
      .limit(limit);

    return rows.map((row) => {
      const username = publicAccountName(row.username, row.authorDeletedAt);
      const displayName = publicAccountDisplayName(
        row.displayName,
        row.username,
        row.authorDeletedAt,
      );
      return {
        id: `comment:${row.id}`,
        kind: 'comment' as const,
        createdAt: secondsToDate(row.occurredAt),
        actor: {
          username,
          displayName,
          avatarUrl: row.authorDeletedAt ? null : (row.avatarUrl ?? null),
        },
        body: snippet(row.body || '…'),
        subtitle: row.lemma,
        target: { type: 'word', id: row.wordId },
      };
    });
  }

  async listRecentVotes(
    limit: number,
    before?: ActivityCursor,
    excludeUserId?: string,
  ): Promise<ActivityItem[]> {
    const occurredAt = occurredAtSql(votes.updatedAt, votes.createdAt);
    const rows = await this.db
      .select({
        id: votes.id,
        entityType: votes.entityType,
        entityId: votes.entityId,
        value: votes.value,
        occurredAt,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        authorDeletedAt: users.deletedAt,
      })
      .from(votes)
      .innerJoin(users, eq(users.id, votes.userId))
      .where(
        and(
          isNull(users.deletedAt),
          notSelfSql(votes.userId, excludeUserId),
          // Vote orang lain atas kata milik sendiri: soal feed "karya orang
          // lain", vote di kata saya bukan termasuk.
          notMyWordVoteSql(excludeUserId),
          isNotNull(occurredAt),
          keysetBefore(occurredAt, votes.id, before, 'vote'),
        ),
      )
      .orderBy(desc(occurredAt), desc(votes.id))
      .limit(limit);

    const previewMap = await this.resolveVotePreviews(
      rows.map((r) => ({ entityType: r.entityType, entityId: r.entityId })),
    );

    // Vote ke kata/komentar yang katanya tidak boleh di feed: buang.
    const visible = rows.filter(
      (row) =>
        !WORD_BOUND_VOTE_TYPES.has(row.entityType) ||
        previewMap.has(`${row.entityType}:${row.entityId}`),
    );

    return visible.map((row) => {
      const username = publicAccountName(row.username, row.authorDeletedAt);
      const displayName = publicAccountDisplayName(
        row.displayName,
        row.username,
        row.authorDeletedAt,
      );
      const preview = previewMap.get(`${row.entityType}:${row.entityId}`);
      const targetLabel = preview?.label
        ? quoted(preview.label)
        : row.entityType === 'discussion'
          ? 'Diskusi'
          : 'Entri kamus';
      // Netral, bukan vonis; nama actor sudah jadi subjek di atas body.
      // Mobile membaca arah ikon dari akhiran ini.
      const body =
        row.value >= 0
          ? `${targetLabel} sudah pas`
          : `${targetLabel} perlu dicek ulang`;
      return {
        id: `vote:${row.id}`,
        kind: 'vote' as const,
        createdAt: secondsToDate(row.occurredAt),
        actor: {
          username,
          displayName,
          avatarUrl: row.avatarUrl ?? null,
        },
        body,
        subtitle: null,
        target: preview?.wordId
          ? { type: 'word', id: preview.wordId }
          : row.entityType === 'discussion'
            ? { type: 'discussion', id: row.entityId }
            : { type: row.entityType, id: row.entityId },
      };
    });
  }

  async listRecentDiscussions(
    limit: number,
    before?: ActivityCursor,
    excludeUserId?: string,
  ): Promise<ActivityItem[]> {
    const occurredAt = occurredAtSql(discussions.createdAt);
    const rows = await this.db
      .select({
        id: discussions.id,
        body: discussions.body,
        occurredAt,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        authorDeletedAt: users.deletedAt,
      })
      .from(discussions)
      .leftJoin(users, eq(users.id, discussions.userId))
      .where(
        and(
          eq(discussions.status, 'published'),
          notSelfSql(discussions.userId, excludeUserId),
          isNotNull(occurredAt),
          keysetBefore(occurredAt, discussions.id, before, 'discussion'),
        ),
      )
      .orderBy(desc(occurredAt), desc(discussions.id))
      .limit(limit);

    return rows.map((row) => {
      const username = publicAccountName(row.username, row.authorDeletedAt);
      const displayName = publicAccountDisplayName(
        row.displayName,
        row.username,
        row.authorDeletedAt,
      );
      const bodyRaw = row.body?.trim() ?? '';
      return {
        id: `discussion:${row.id}`,
        kind: 'discussion' as const,
        createdAt: secondsToDate(row.occurredAt),
        actor: {
          username,
          displayName,
          avatarUrl: row.authorDeletedAt ? null : (row.avatarUrl ?? null),
        },
        body: bodyRaw ? snippet(bodyRaw) : 'Membuka ruang diskusi',
        subtitle: null,
        target: { type: 'discussion', id: row.id },
      };
    });
  }

  async listRecentApprovedContributions(
    entityTypes: Array<'word_image' | 'word_audio' | 'pronunciation' | 'example'>,
    limit: number,
    before?: ActivityCursor,
    excludeUserId?: string,
  ): Promise<ActivityItem[]> {
    if (entityTypes.length === 0) return [];

    const occurredAt = occurredAtSql(contributions.createdAt);
    const rows = await this.db
      .select({
        id: contributions.id,
        entityType: contributions.entityType,
        entityId: contributions.entityId,
        occurredAt,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        authorDeletedAt: users.deletedAt,
      })
      .from(contributions)
      .leftJoin(users, eq(users.id, contributions.userId))
      .where(
        and(
          inArray(contributions.status, ['approved', 'corrected']),
          isNull(contributions.deletedAt),
          inArray(contributions.entityType, entityTypes),
          notSelfSql(contributions.userId, excludeUserId),
          isNotNull(occurredAt),
          keysetBefore(occurredAt, contributions.id, before, entityTypes),
        ),
      )
      .orderBy(desc(occurredAt), desc(contributions.id))
      .limit(limit);

    const parents = await this.resolveContributionParents(
      rows.map((r) => ({ entityType: r.entityType, entityId: r.entityId })),
    );

    // Induk kata tidak boleh di feed (berlabel terlarang / turun / hapus): buang.
    const visible = rows.filter((row) => parents.has(`${row.entityType}:${row.entityId}`));

    return visible.map((row) => {
      const username = publicAccountName(row.username, row.authorDeletedAt);
      const displayName = publicAccountDisplayName(
        row.displayName,
        row.username,
        row.authorDeletedAt,
      );
      const parent = parents.get(`${row.entityType}:${row.entityId}`);
      const action = CONTRIB_BODY[row.entityType] ?? row.entityType;
      const lemma = parent?.lemma;
      const kind = row.entityType as ActivityKind;
      return {
        id: `${kind}:${row.id}`,
        kind,
        createdAt: secondsToDate(row.occurredAt),
        actor: {
          username,
          displayName,
          avatarUrl: row.authorDeletedAt ? null : (row.avatarUrl ?? null),
        },
        body: lemma ? `${action} · ${quoted(lemma)}` : action,
        subtitle: lemma ?? null,
        target: parent?.wordId ? { type: 'word', id: parent.wordId } : null,
      };
    });
  }

  /**
   * Search-miss tayang. `excludeUserId` membuang miss yang pernah dicari user
   * itu: miss tidak punya "pemilik" (satu baris dipakai bersama semua orang
   * yang mencari istilah sama), tapi pemicunya bisa dilacak lewat tabel
   * `search_miss_searchers`. Tanpa flag, feed publik utuh seperti sebelumnya.
   */
  async listRecentVisibleSearchMisses(
    limit: number,
    before?: ActivityCursor,
    excludeUserId?: string,
  ): Promise<ActivityItem[]> {
    // Aksi = pencarian terakhir. Sama persis untuk ORDER BY dan keyset.
    const occurredAt = occurredAtSql(searchMisses.lastSearchedAt, searchMisses.createdAt);
    const rows = await this.db
      .select({
        id: searchMisses.id,
        term: searchMisses.term,
        direction: searchMisses.direction,
        occurredAt,
      })
      .from(searchMisses)
      .where(
        and(
          isNull(searchMisses.deletedAt),
          eq(searchMisses.isVisible, true),
          // Arah lemma: belum ada kata published. Translation: tetap tampilkan
          // (klasifikasi penuh mirip repo search-miss; V1 cukup skip lemma fulfilled).
          sql`NOT (
            ${searchMisses.direction} = 'lemma' AND ${isFulfilledLemmaSql}
          )`,
          sql`NOT ${matchesExcludedLemmaSql}`,
          // Miss yang pernah dicari viewer sendiri disembunyikan. EXISTS (bukan
          // join) supaya tidak menggandakan baris miss.
          excludeUserId
            ? sql`not exists (
                select 1 from ${searchMissSearchers} sms
                where sms.search_miss_id = ${searchMisses.id}
                  and sms.user_id = ${excludeUserId}
              )`
            : undefined,
          isNotNull(occurredAt),
          keysetBefore(occurredAt, searchMisses.id, before, 'search_miss'),
        ),
      )
      .orderBy(desc(occurredAt), desc(searchMisses.id))
      .limit(limit);

    return rows.map((row) => ({
      id: `search_miss:${row.id}`,
      kind: 'search_miss' as const,
      createdAt: secondsToDate(row.occurredAt),
      actor: null,
      body: searchMissBody(row.term),
      subtitle: null,
      target: {
        type: 'search_miss',
        id: row.id,
      },
    }));
  }

  async listRecentWelcomes(
    limit: number,
    before?: ActivityCursor,
    excludeUserId?: string,
  ): Promise<ActivityItem[]> {
    // Tampil setelah akun terverifikasi (OTP email atau OAuth langsung verified).
    // Timeline aksi "bergabung" = waktu verifikasi; OAuth/legacy tanpa kolom
    // itu jatuh ke createdAt (mereka memang verified saat daftar/backfill).
    const occurredAt = occurredAtSql(users.emailVerifiedAt, users.createdAt);
    const rows = await this.db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        occurredAt,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(
        and(
          eq(users.emailVerified, true),
          eq(users.isActive, true),
          isNull(users.deletedAt),
          ne(users.id, ANONIM_USER_ID),
          notSelfSql(users.id, excludeUserId),
          isNotNull(occurredAt),
          keysetBefore(occurredAt, users.id, before, 'welcome'),
        ),
      )
      .orderBy(desc(occurredAt), desc(users.id))
      .limit(limit);

    return rows.map((row) => {
      const username = publicAccountName(row.username, row.deletedAt);
      const displayName = publicAccountDisplayName(
        row.displayName,
        row.username,
        row.deletedAt,
      );
      return {
        id: `welcome:${row.id}`,
        kind: 'welcome' as const,
        createdAt: secondsToDate(row.occurredAt),
        actor: {
          username,
          displayName,
          avatarUrl: row.deletedAt ? null : (row.avatarUrl ?? null),
        },
        body: 'Bergabung di SambasKu',
        subtitle: 'Selamat datang',
        target: { type: 'user', id: row.id },
      };
    });
  }

  async listRecentCardShares(
    limit: number,
    before?: ActivityCursor,
    excludeUserId?: string,
  ): Promise<ActivityItem[]> {
    const occurredAt = occurredAtSql(wordCardShares.createdAt);
    const rows = await this.db
      .select({
        id: wordCardShares.id,
        wordId: wordCardShares.wordId,
        occurredAt,
        lemma: words.lemma,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(wordCardShares)
      .innerJoin(words, eq(words.id, wordCardShares.wordId))
      .innerJoin(users, eq(users.id, wordCardShares.userId))
      .where(
        and(
          isNull(users.deletedAt),
          feedVisibleWordSql(),
          notSelfSql(wordCardShares.userId, excludeUserId),
          isNotNull(occurredAt),
          keysetBefore(occurredAt, wordCardShares.id, before, 'card_share'),
        ),
      )
      .orderBy(desc(occurredAt), desc(wordCardShares.id))
      .limit(limit);

    return rows.map((row) => ({
      id: `card_share:${row.id}`,
      kind: 'card_share' as const,
      createdAt: secondsToDate(row.occurredAt),
      actor: {
        username: row.username,
        displayName: row.displayName ?? row.username,
        avatarUrl: row.avatarUrl ?? null,
      },
      body: `Membagikan kartu · ${quoted(row.lemma)}`,
      subtitle: row.lemma,
      target: { type: 'word', id: row.wordId },
    }));
  }

  async listRecentAppliedSuggestions(
    limit: number,
    before?: ActivityCursor,
    excludeUserId?: string,
  ): Promise<ActivityItem[]> {
    // Tayang dulu (baseline) sejak dibuat; sisanya sejak disetujui.
    const appliedAt = sql`CASE WHEN ${wordEditSuggestions.baselineSnapshot} IS NOT NULL
      THEN ${wordEditSuggestions.createdAt}
      ELSE ${wordEditSuggestions.reviewedAt} END`;
    // Sama persis untuk ORDER BY dan keyset.
    const occurredAt = occurredAtSql(appliedAt);
    const rows = await this.db
      .select({
        id: wordEditSuggestions.id,
        wordId: wordEditSuggestions.wordId,
        occurredAt,
        lemma: words.lemma,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(wordEditSuggestions)
      .innerJoin(words, eq(words.id, wordEditSuggestions.wordId))
      .innerJoin(users, eq(users.id, wordEditSuggestions.userId))
      .where(
        and(
          isNull(wordEditSuggestions.deletedAt),
          isNull(users.deletedAt),
          or(
            and(
              inArray(wordEditSuggestions.status, ['approved', 'corrected']),
              isNotNull(wordEditSuggestions.reviewedAt),
            ),
            and(
              eq(wordEditSuggestions.status, 'pending'),
              isNotNull(wordEditSuggestions.baselineSnapshot),
            ),
          ),
          feedVisibleWordSql(),
          notSelfSql(wordEditSuggestions.userId, excludeUserId),
          isNotNull(occurredAt),
          keysetBefore(occurredAt, wordEditSuggestions.id, before, 'suggestion'),
        ),
      )
      .orderBy(desc(occurredAt), desc(wordEditSuggestions.id))
      .limit(limit);

    // Hanya aksi + lemma: teks bebas usulan tidak pernah masuk feed.
    return rows.map((row) => ({
      id: `suggestion:${row.id}`,
      kind: 'suggestion' as const,
      createdAt: secondsToDate(row.occurredAt),
      actor: {
        username: row.username,
        displayName: row.displayName ?? row.username,
        avatarUrl: row.avatarUrl ?? null,
      },
      body: `Mengusulkan perubahan · ${quoted(row.lemma)}`,
      subtitle: row.lemma,
      target: { type: 'word', id: row.wordId },
    }));
  }

  async recordCardShare(
    userId: string,
    wordId: string,
  ): Promise<'recorded' | 'duplicate' | 'word_not_found'> {
    const [word] = await this.db
      .select({ id: words.id })
      .from(words)
      .where(and(eq(words.id, wordId), isNull(words.deletedAt), eq(words.status, 'published')))
      .limit(1);
    if (!word) return 'word_not_found';

    // ponytail: cek-lalu-insert tanpa unique index; dua tap bersamaan bisa
    // mencatat dua baris. Dampak cuma baris feed ganda. Upgrade: kolom hari + unique.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [recent] = await this.db
      .select({ id: wordCardShares.id })
      .from(wordCardShares)
      .where(
        and(
          eq(wordCardShares.userId, userId),
          eq(wordCardShares.wordId, wordId),
          gt(wordCardShares.createdAt, since),
        ),
      )
      .limit(1);
    if (recent) return 'duplicate';

    await this.db.insert(wordCardShares).values({ userId, wordId });
    return 'recorded';
  }

  private async attachWordSenses(wordIds: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (wordIds.length === 0) return out;

    const meaningRows = await this.db
      .select({
        wordId: meanings.wordId,
        definition: meanings.definition,
        isHaveDefinition: meanings.isHaveDefinition,
      })
      .from(meanings)
      .where(
        and(
          inArray(meanings.wordId, wordIds),
          isNull(meanings.deletedAt),
          eq(meanings.status, 'published'),
        ),
      )
      .orderBy(meanings.wordId, meanings.id);

    for (const row of meaningRows) {
      if (out.has(row.wordId)) continue;
      if (row.isHaveDefinition && row.definition?.trim()) {
        out.set(row.wordId, row.definition.trim());
      }
    }
    return out;
  }

  private async resolveVotePreviews(
    targets: Array<{ entityType: string; entityId: string }>,
  ): Promise<Map<string, { label: string; wordId: string | null }>> {
    const out = new Map<string, { label: string; wordId: string | null }>();
    if (targets.length === 0) return out;

    const idsOf = (type: string) =>
      targets.filter((t) => t.entityType === type).map((t) => t.entityId);

    const wordIds = idsOf('word');
    if (wordIds.length > 0) {
      const rows = await this.db
        .select({ id: words.id, lemma: words.lemma })
        .from(words)
        .where(and(inArray(words.id, wordIds), feedVisibleWordSql()));
      for (const r of rows) out.set(`word:${r.id}`, { label: r.lemma, wordId: r.id });
    }

    const commentIds = idsOf('comment');
    if (commentIds.length > 0) {
      const rows = await this.db
        .select({ id: comments.id, lemma: words.lemma, wordId: comments.wordId })
        .from(comments)
        .innerJoin(words, eq(words.id, comments.wordId))
        .where(and(inArray(comments.id, commentIds), feedVisibleWordSql()));
      for (const r of rows) {
        out.set(`comment:${r.id}`, { label: r.lemma, wordId: r.wordId });
      }
    }

    return out;
  }

  private async resolveContributionParents(
    items: Array<{ entityType: string; entityId: string }>,
  ): Promise<Map<string, { lemma: string; wordId: string }>> {
    const out = new Map<string, { lemma: string; wordId: string }>();
    if (items.length === 0) return out;

    const idsOf = (type: string) =>
      items.filter((i) => i.entityType === type).map((i) => i.entityId);

    const pronunciationIds = idsOf('pronunciation');
    if (pronunciationIds.length > 0) {
      const rows = await this.db
        .select({ id: pronunciations.id, lemma: words.lemma, wordId: pronunciations.wordId })
        .from(pronunciations)
        .innerJoin(words, eq(words.id, pronunciations.wordId))
        .where(and(inArray(pronunciations.id, pronunciationIds), feedVisibleWordSql()));
      for (const r of rows) {
        out.set(`pronunciation:${r.id}`, { lemma: r.lemma, wordId: r.wordId });
      }
    }

    const imageIds = idsOf('word_image');
    if (imageIds.length > 0) {
      const rows = await this.db
        .select({ id: wordImages.id, lemma: words.lemma, wordId: wordImages.wordId })
        .from(wordImages)
        .innerJoin(words, eq(words.id, wordImages.wordId))
        .where(and(inArray(wordImages.id, imageIds), feedVisibleWordSql()));
      for (const r of rows) out.set(`word_image:${r.id}`, { lemma: r.lemma, wordId: r.wordId });
    }

    const audioIds = idsOf('word_audio');
    if (audioIds.length > 0) {
      const rows = await this.db
        .select({ id: wordAudios.id, lemma: words.lemma, wordId: wordAudios.wordId })
        .from(wordAudios)
        .innerJoin(words, eq(words.id, wordAudios.wordId))
        .where(and(inArray(wordAudios.id, audioIds), feedVisibleWordSql()));
      for (const r of rows) out.set(`word_audio:${r.id}`, { lemma: r.lemma, wordId: r.wordId });
    }

    const exampleIds = idsOf('example');
    if (exampleIds.length > 0) {
      const rows = await this.db
        .select({ id: examples.id, lemma: words.lemma, wordId: meanings.wordId })
        .from(examples)
        .innerJoin(meanings, eq(meanings.id, examples.meaningId))
        .innerJoin(words, eq(words.id, meanings.wordId))
        .where(and(inArray(examples.id, exampleIds), feedVisibleWordSql()));
      for (const r of rows) out.set(`example:${r.id}`, { lemma: r.lemma, wordId: r.wordId });
    }

    return out;
  }
}
