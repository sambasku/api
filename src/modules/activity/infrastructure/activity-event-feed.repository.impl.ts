import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { activityEvents, searchMisses, users, votes, words } from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type { PublicActivityItem } from '@/modules/user/domain/entities/public-profile.entity';
import { FEED_EXCLUDED_USAGE_LABELS } from '@/shared/constants/usage-labels';
import {
  publicAccountDisplayName,
  publicAccountName,
} from '@/shared/constants/deleted-account';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import type { ActivityItem, ActivityKind } from '../domain/entities/activity-item.entity';
import type { ActivityEventKind } from '../domain/entities/activity-event.entity';
import type { ActivityCursor } from '../domain/merge-activity';

/**
 * Baca feed dari `activity_events` (write-through log) - pengganti agregasi
 * 11 query sumber. Event dibekukan saat kejadian; hanya visibility yang dicek
 * read-time.
 *
 * Visibility read-time per event:
 * - hidden_at is null (event tidak dicabut);
 * - bila target_word_id terisi: kata masih published, tidak soft-delete, tidak
 *   berlabel terlarang (join words);
 * - aktor: akun terhapus tetap tampil sebagai label "Akun tidak ditemukan"
 *   (karya tidak ikut hilang), avatar dikosongkan;
 * - excludeUserId: buang event milik viewer sendiri.
 */

const KIND_TO_WIRE: Record<ActivityEventKind, ActivityKind> = {
  word_created: 'word',
  word_verified: 'verification', // #99: verifikasi dibedakan dari vote di wire
  contribution_image: 'word_image',
  contribution_audio: 'word_audio',
  contribution_pron: 'pronunciation',
  contribution_example: 'example',
  comment_created: 'comment',
  vote_word: 'vote',
  vote_comment: 'vote',
  discussion_created: 'discussion',
  suggestion_applied: 'suggestion',
  suggestion_selfapply: 'suggestion',
  suggestion_created: 'suggestion',
  contribution_submitted: 'contribution',
  search_miss: 'search_miss',
  user_joined: 'welcome',
  card_shared: 'card_share',
};

/** Label aksi per kind (badan feed; lemma diresolve terpisah). */
const KIND_BODY: Record<ActivityEventKind, string> = {
  word_created: '',
  word_verified: 'Memverifikasi kata',
  contribution_image: 'Menambah foto',
  contribution_audio: 'Merekam suara',
  contribution_pron: 'Menambah cara baca',
  contribution_example: 'Menambah contoh kalimat',
  comment_created: '',
  vote_word: '',
  vote_comment: '',
  discussion_created: '',
  suggestion_applied: 'Mengusulkan perubahan',
  suggestion_selfapply: 'Melengkapi kata',
  suggestion_created: 'Mengusulkan perubahan',
  contribution_submitted: 'Mengusulkan kata baru',
  search_miss: '',
  user_joined: 'Bergabung di SambasKu',
  card_shared: 'Membagikan kartu',
};

function quoted(s: string): string {
  return `"${s}"`;
}

/**
 * Cursor profil = id event (ULID). ULID monoton naik dengan waktu, jadi
 * id-desc == occurred_at-desc; keyset tuple (waktu, id) tetap benar dengan
 * waktu yang didekode dari 10 karakter pertama ULID (Crockford base32).
 */
const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function cursorFromEventId(id: string): { id: string; createdAt: Date } {
  let ms = 0;
  for (const c of id.slice(0, 10)) {
    const v = ULID_ALPHABET.indexOf(c);
    if (v < 0) return { id, createdAt: new Date(0) };
    ms = ms * 32 + v;
  }
  return { id, createdAt: new Date(ms) };
}

/** Kategori timeline profil publik (19-api-profil-publik). */
type ProfileCategory = 'contribution' | 'comment' | 'verification' | 'vote';

/**
 * Kind event -> kategori profil. Persis 4 set lama; kind lain (welcome,
 * search_miss, discussion, card_shared) memang tak pernah tayang di profil.
 */
const PROFILE_KIND_SETS: Record<ProfileCategory, ActivityEventKind[]> = {
  contribution: [
    'word_created',
    'contribution_image',
    'contribution_audio',
    'contribution_pron',
    'contribution_example',
    'suggestion_applied',
    'suggestion_created',
    'contribution_submitted',
  ],
  comment: ['comment_created'],
  verification: ['word_verified', 'suggestion_selfapply'],
  vote: ['vote_word', 'vote_comment'],
};

/** Mode merge profil: 1 query, 13 kind = gabungan 4 kategori (#103). */
const MERGED_PROFILE_KINDS: ActivityEventKind[] = [
  ...PROFILE_KIND_SETS.contribution,
  ...PROFILE_KIND_SETS.comment,
  ...PROFILE_KIND_SETS.verification,
  ...PROFILE_KIND_SETS.vote,
];

function profileCategoryOf(kind: ActivityEventKind): ProfileCategory {
  const hit = (Object.keys(PROFILE_KIND_SETS) as ProfileCategory[]).find(
    (cat) => (PROFILE_KIND_SETS[cat] as readonly string[]).includes(kind),
  );
  return hit ?? 'contribution';
}

/**
 * Baris selectVisible + kolom JOIN (#103): semua kebutuhan buildItem/
 * listPublicByActor datang dari SATU query tanpa resolve per baris.
 */
interface FeedRow {
  id: string;
  kind: string;
  actorId: string | null;
  targetWordId: string | null;
  targetId: string | null;
  occurredAt: Date;
  payload: string | null;
  wordStatus: string | null;
  lemma: string | null;
  actorUserId: string | null;
  actorUsername: string | null;
  actorDisplayName: string | null;
  actorAvatarUrl: string | null;
  actorDeletedAt: Date | null;
  missTerm: string | null;
  voteValue: number | null;
}

export class ActivityEventFeedRepositoryImpl {
  constructor(private readonly db: AppDatabase) {}

  /** Halaman feed beranda (semua kind). Keyset (occurred_at, id) desc. */
  async listFeed(
    limit: number,
    before?: ActivityCursor,
    excludeUserId?: string,
  ): Promise<ActivityItem[]> {
    // #56: event superseded (usulan yang ceritanya sudah jadi verifikasi)
    // tidak tayang di feed home - profil (listByActor) tetap memuatnya.
    const rows = await this.selectVisible(limit, before, excludeUserId, undefined, undefined, true);
    return this.buildItems(rows);
  }

  /** Halaman timeline profil publik (event actor tertentu). */
  async listByActor(
    actorId: string,
    limit: number,
    before?: ActivityCursor,
  ): Promise<ActivityItem[]> {
    const rows = await this.selectVisible(limit, before, undefined, actorId);
    return this.buildItems(rows);
  }

  /**
   * Timeline profil publik dalam bentuk PublicActivityItem (19-api-profil-publik).
   * Kategori profil dipetakan dari kind event:
   * - contribution: contribution_* + word_created + suggestion_applied (pengusul)
   * - comment: comment_created
   * - verification: word_verified + suggestion_selfapply
   * - vote: vote_*
   * Cursor = id event (ULID monoton turun) - kontrak lama pakai id sumber,
   * keduanya opaque bagi klien.
   */
  async listPublicByActor(
    actorId: string,
    category: ProfileCategory | 'merged',
    limit: number,
    cursor?: string,
  ): Promise<{ items: PublicActivityItem[]; nextCursor: string | null; hasMore: boolean }> {
    // 'merged' = 1 query utk semua kategori (use-case profil dulu memanggil
    // method ini 4x paralel -> 4 subrequest tiap kali; #103).
    const kinds =
      category === 'merged'
        ? MERGED_PROFILE_KINDS
        : PROFILE_KIND_SETS[category];
    const rows = await this.selectVisible(
      limit + 1,
      cursor ? cursorFromEventId(cursor) : undefined,
      undefined,
      actorId,
      kinds,
    );
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items: PublicActivityItem[] = [];
    for (const row of page) {
      const kind = row.kind as ActivityEventKind;
      // #103: lemma & arah vote datang dari JOIN selectVisible - tanpa
      // resolveWord / query tabel votes per baris.
      const lemma = row.targetWordId ? row.lemma : null;
      // #94: payload beku menang (satu sumber kebenaran feed+profil). Live
      // votes hanya fallback untuk event lama tanpa payload.
      const frozen = row.payload?.trim() || null;
      const voteValue = row.voteValue;
      items.push({
        id: row.id,
        // mode 'merged': kategori diturunkan dari kind (kontrak 4 kategori
        // profil tetap utuh).
        kind: category === 'merged' ? profileCategoryOf(kind) : category,
        occurredAt: row.occurredAt,
        wordId: row.targetWordId,
        lemma,
        summary:
          frozen ?? this.publicSummary(kind, lemma, row.targetId, voteValue),
      });
    }
    return {
      items,
      nextCursor: hasMore && page[page.length - 1] ? page[page.length - 1]!.id : null,
      hasMore,
    };
  }

  /** Wording timeline profil: aksi berimbuhan tanpa subjek (docs 23/19). */
  private publicSummary(
    kind: ActivityEventKind,
    lemma: string | null,
    targetId: string | null,
    voteValue: number | null = null,
  ): string {
    const q = lemma ? `"${lemma}"` : '';
    switch (kind) {
      case 'word_created':
        return `Menambahkan kata ${q}`.trim();
      case 'contribution_image':
        return `Menambahkan foto ${q}`.trim();
      case 'contribution_audio':
        return `Menambahkan rekaman suara ${q}`.trim();
      case 'contribution_pron':
        return `Menambahkan cara baca ${q}`.trim();
      case 'contribution_example':
        return `Menambahkan contoh kalimat ${q}`.trim();
      case 'suggestion_applied':
        return `Usulan perubahan diterima ${q}`.trim();
      case 'suggestion_selfapply':
        return `Melengkapi kata ${q}`.trim();
      case 'suggestion_created':
        return `Mengusulkan perubahan ${q}`.trim();
      case 'contribution_submitted':
        return `Mengusulkan kata baru ${q}`.trim();
      case 'comment_created':
        return targetId ? `Mengomentari kata ${q}`.trim() : 'Mengomentari';
      case 'word_verified':
        return `Memverifikasi kata ${q}`.trim();
      case 'vote_word':
      case 'vote_comment':
        // Kontrak feed lama: akhiran summary = arah vote (mobile parse ini).
        return voteValue === null || voteValue >= 0
          ? `${q} sudah pas`.trim()
          : `${q} perlu dicek ulang`.trim();
      default:
        return lemma ?? '';
    }
  }

  // ---------------------------------------------------------------- select --

  private feedSafeWordSql(): SQL | undefined {
    return sql`(
      ${words.deletedAt} is null
      and ${words.status} = 'published'
      and ${sql.join(
        FEED_EXCLUDED_USAGE_LABELS.map(
          (label) => sql`${words.usageLabels} NOT LIKE ${`%\"${label}\"%`}`,
        ),
        sql` and `,
      )}
    )`;
  }

  private baseConditions(excludeUserId?: string, actorId?: string): SQL[] {
    const conds: SQL[] = [sql`${activityEvents.hiddenAt} is null`];
    if (excludeUserId) {
      conds.push(sql`(${activityEvents.actorId} is null or ${activityEvents.actorId} <> ${excludeUserId})`);
    }
    if (actorId) {
      conds.push(sql`${activityEvents.actorId} = ${actorId}`);
    }
    return conds;
  }

  private async selectVisible(
    limit: number,
    before?: ActivityCursor,
    excludeUserId?: string,
    actorId?: string,
    kinds?: ActivityEventKind[],
    excludeSuperseded?: boolean,
  ) {
    const occurredAt = activityEvents.occurredAt;
    const conds = this.baseConditions(excludeUserId, actorId);
    if (excludeSuperseded) {
      // #56: superseded = cerita lama yang sudah digantikan verifikasi.
      conds.push(sql`${activityEvents.supersededAt} is null`);
    }
    if (kinds && kinds.length > 0) {
      conds.push(inArray(activityEvents.kind, kinds));
    }

    if (before) {
      const beforeSeconds = Math.floor(before.createdAt.getTime() / 1000);
      const colon = before.id.indexOf(':');
      const entityId = colon >= 0 ? before.id.slice(colon + 1) : before.id;
      // Keyset tuple (occurred_at, id). Id event ULID monoton: detik sama ->
      // tiebreak id tetap benar (profil cursor = ULID polos, wire = kind:ulid).
      conds.push(
        sql`(${occurredAt}, ${activityEvents.id}) < (${beforeSeconds}, ${entityId})`,
      );
    }

    const rows = await this.db
      .select({
        id: activityEvents.id,
        kind: activityEvents.kind,
        actorId: activityEvents.actorId,
        targetWordId: activityEvents.targetWordId,
        targetId: activityEvents.targetId,
        occurredAt: activityEvents.occurredAt,
        // copy beku saat kejadian (#94): null = fallback bodyFor read-time
        payload: activityEvents.payload,
        // status kata untuk keputusan CTA (pending = tanpa target)
        wordStatus: words.status,
        // #103: field dari JOIN - ganti resolveWord/resolveActor per baris.
        lemma: words.lemma,
        actorUserId: users.id,
        actorUsername: users.username,
        actorDisplayName: users.displayName,
        actorAvatarUrl: users.avatarUrl,
        actorDeletedAt: users.deletedAt,
        // search_miss: term body feed; guard kind supaya kolisi id antar
        // tabel (ULID) tak pernah match utk kind lain.
        missTerm: searchMisses.term,
        // fallback arah vote utk event lama tanpa payload (#94).
        voteValue: votes.value,
      })
      .from(activityEvents)
      .leftJoin(
        words,
        and(
          eq(words.id, activityEvents.targetWordId),
          // hanya kata layak-tayang yang lolos; event tanpa kata ikut (left join).
          // Kata pending (usulan baru) tetap dijoin supaya lemma kebaca;
          // event-nya dikecualikan dari filter published lewat join ini.
          sql`(${this.feedSafeWordSql()} or ${activityEvents.kind} = 'contribution_submitted')`,
        ),
      )
      .leftJoin(users, eq(users.id, activityEvents.actorId))
      .leftJoin(
        searchMisses,
        and(
          eq(activityEvents.kind, 'search_miss'),
          eq(searchMisses.id, activityEvents.targetId),
        ),
      )
      .leftJoin(
        votes,
        and(
          eq(votes.userId, activityEvents.actorId),
          sql`((${activityEvents.kind} = 'vote_word' and ${votes.entityType} = 'word' and ${votes.entityId} = ${activityEvents.targetId}) or (${activityEvents.kind} = 'vote_comment' and ${votes.entityType} = 'comment' and ${votes.entityId} = ${activityEvents.targetId}))`,
        ),
      )
      .where(
        and(
          ...conds,
          // event yang menyebut kata harus lolos visibility kata;
          // event tanpa kata (welcome, search_miss tanpa word) tetap masuk.
          sql`(${activityEvents.targetWordId} is null or ${words.id} is not null)`,
        ),
      )
      .orderBy(desc(activityEvents.occurredAt), desc(activityEvents.id))
      .limit(limit);
    return rows;
  }

  // ----------------------------------------------------------------- build --

  private buildItems(rows: FeedRow[]): ActivityItem[] {
    const out: ActivityItem[] = [];
    for (const row of rows) {
      const item = this.buildItem(row);
      if (item) out.push(item);
    }
    return out;
  }

  private buildItem(row: FeedRow): ActivityItem | null {
    const kind = row.kind as ActivityEventKind;
    // #103: semua field datang dari JOIN selectVisible - tanpa query per baris.
    const actor = this.actorFromRow(row);
    const word =
      row.targetWordId && row.lemma !== null
        ? { id: row.targetWordId, lemma: row.lemma }
        : null;
    let lemma = word?.lemma ?? null;

    // search_miss: lemma tidak ada; body pakai term aslinya (dari JOIN).
    if (kind === 'search_miss') {
      lemma = row.missTerm ?? null;
    }

    // Copy beku saat kejadian (#94) menang; fallback bodyFor untuk event
    // lama/backfill tanpa payload. #56: payload verifikasi menyimpan
    // placeholder {lemma} (kata belum tentu published saat verify) -
    // disubstitusi read-time dengan lemma JOIN.
    const frozen = row.payload?.trim() ? row.payload.trim() : null;
    const body =
      frozen !== null
        ? lemma
          ? frozen.replaceAll('{lemma}', lemma)
          : frozen.replaceAll(' {lemma}', '').replace('{lemma}', '')
        : this.bodyFor(kind, lemma);
    const subtitle = this.subtitleFor(kind, lemma);
    // #99: arah vote dari copy beku (#94) - event kind DB tetap vote_word/
    // vote_comment, split cuma di wire supaya feed home variatif tanpa
    // migrasi kinds (kinds DB = kontrak AGENTS.md #25).
    let wire: ActivityKind = KIND_TO_WIRE[kind];
    if (wire === 'vote') {
      wire = /perlu dicek ulang/.test(body) ? 'vote_down' : 'vote_up';
    }
    // Kata masih pending (usulan baru): tampil tanpa CTA - target null.
    // Setelah approve, read-time join published menghidupkan CTA lagi.
    const target = row.wordStatus && row.wordStatus !== 'published' ? null : this.targetFor(kind, row, word);
    return {
      id: `${wire}:${row.id}`,
      kind: wire as ActivityKind,
      createdAt: row.occurredAt,
      actor,
      body,
      subtitle,
      target,
    };
  }

  /**
   * Transform JOIN users -> bentuk wire. Replikasi 1:1 resolveActor lama
   * (per-baris query) - #103 N+1 dihilangkan, perilaku identik.
   */
  private actorFromRow(row: FeedRow) {
    if (!row.actorUserId) return null;
    const username = publicAccountName(row.actorUsername!, row.actorDeletedAt);
    const displayName = publicAccountDisplayName(
      row.actorDisplayName,
      row.actorUsername,
      row.actorDeletedAt,
    );
    // Akun terhapus: karya tetap tayang berlabel, tapi tidak bisa dibuka profilnya.
    const hidden = !!row.actorDeletedAt || row.actorUserId === ANONIM_USER_ID;
    return {
      username: hidden ? null : username,
      displayName: username || displayName ? displayName ?? DELETED_LABEL : null,
      avatarUrl: row.actorDeletedAt ? null : (row.actorAvatarUrl ?? null),
    };
  }

  private bodyFor(kind: ActivityEventKind, lemma: string | null): string {
    switch (kind) {
      case 'word_created':
        return lemma ? quoted(lemma) : '';
      case 'word_verified':
        return lemma ? `Memverifikasi kata · ${quoted(lemma)}` : 'Memverifikasi kata';
      case 'suggestion_applied':
        return lemma ? `Mengusulkan perubahan · ${quoted(lemma)}` : 'Mengusulkan perubahan';
      case 'suggestion_selfapply':
        return lemma ? `Melengkapi kata · ${quoted(lemma)}` : 'Melengkapi kata';
      case 'card_shared':
        return lemma ? `Membagikan kartu · ${quoted(lemma)}` : 'Membagikan kartu';
      case 'search_miss':
        return lemma ? `Mencari "${lemma}" - belum ada di kamus.` : 'Mencari - belum ada di kamus.';
      case 'user_joined':
        return 'Bergabung di SambasKu';
      case 'contribution_image':
      case 'contribution_audio':
      case 'contribution_pron':
      case 'contribution_example':
        return lemma ? `${KIND_BODY[kind]} · ${quoted(lemma)}` : KIND_BODY[kind];
      default:
        return KIND_BODY[kind] ?? '';
    }
  }

  private subtitleFor(kind: ActivityEventKind, lemma: string | null): string | null {
    switch (kind) {
      case 'word_created':
        return 'Baru ditambahkan';
      case 'word_verified':
      case 'suggestion_selfapply':
        return 'Verifikasi';
      case 'suggestion_created':
        return 'Usulan baru';
      case 'contribution_submitted':
        return 'Usulan kata baru';
      case 'user_joined':
        return 'Selamat datang';
      default:
        return lemma;
    }
  }

  private targetFor(
    kind: ActivityEventKind,
    row: { targetId: string | null; targetWordId: string | null },
    word: { id: string; lemma: string } | null,
  ): ActivityItem['target'] {
    switch (kind) {
      case 'word_created':
      case 'word_verified':
      case 'contribution_image':
      case 'contribution_audio':
      case 'contribution_pron':
      case 'contribution_example':
      case 'suggestion_applied':
      case 'suggestion_selfapply':
      case 'suggestion_created':
      case 'contribution_submitted':
      case 'card_shared':
      case 'vote_word':
        return word ? { type: 'word', id: word.id } : null;
      case 'comment_created':
        return row.targetId ? { type: 'word', id: row.targetId! } : null;
      case 'vote_comment':
        return row.targetWordId ? { type: 'word', id: row.targetWordId! } : null;
      case 'discussion_created':
        return row.targetId ? { type: 'discussion', id: row.targetId! } : null;
      case 'search_miss':
        return row.targetId ? { type: 'search_miss', id: row.targetId! } : null;
      case 'user_joined':
        return row.targetId ? { type: 'user', id: row.targetId! } : null;
      default:
        return null;
    }
  }
}

const DELETED_LABEL = 'Akun tidak ditemukan';
